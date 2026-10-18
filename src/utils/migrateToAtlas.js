import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import dotenv from 'dotenv';
import { EJSON } from 'bson';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env environment variables automatically
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure resilient DNS resolution to prevent local Windows router SRV lookup failures
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

// Argument parsing: supports any flag order
const rawArgs = process.argv.slice(2);
const isDryRun = rawArgs.some((arg) => arg.toLowerCase() === '--dry-run' || arg.toLowerCase() === '-d');
const targetUri = rawArgs.find((arg) => !arg.startsWith('-')) || process.env.ATLAS_MONGODB_URI;
const LOCAL_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/agrivafoods';

async function run() {
  let localConn = null;
  let atlasConn = null;

  try {
    console.log('====================================================');
    console.log(` AgrivaFoods MongoDB Migration & Backup Utility ${isDryRun ? '[DRY-RUN MODE]' : ''}`);
    console.log('====================================================\n');

    if (isDryRun) {
      console.log(' [DRY-RUN ACTIVE] Simulating migration.');
      console.log(' Zero data will be inserted, updated, dropped, or deleted on Atlas.');
      console.log(' No backup files will be created or overwritten on disk.\n');
    }

    console.log('Connecting to local MongoDB source...');
    localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
    const sourceDbName = localConn.db.databaseName;
    console.log(` Connected to local database: "${sourceDbName}"\n`);

    const collections = await localConn.db.listCollections().toArray();
    const backupData = {};

    console.log('--- Reading Local Collections ---');
    for (const col of collections) {
      const docs = await localConn.db.collection(col.name).find({}).toArray();
      backupData[col.name] = docs;
      console.log(` • ${col.name.padEnd(15)}: ${docs.length} document(s)`);
    }

    // 1. Create verified BSON Extended JSON backup only in live mode
    if (!isDryRun) {
      const backupDir = path.resolve(__dirname, '../../backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const backupFile = path.join(backupDir, `agrivafoods_backup_${Date.now()}.json`);
      fs.writeFileSync(backupFile, EJSON.stringify(backupData, { relaxed: false }));
      console.log(`\n Local BSON Extended JSON backup file saved to:`);
      console.log(`   ${backupFile}\n`);
    } else {
      console.log(`\n [DRY-RUN] Local disk backup creation skipped.\n`);
    }

    // 2. If no target URI provided
    if (!targetUri) {
      console.log('----------------------------------------------------');
      console.log('No Atlas URI provided.');
      console.log('To preview in dry-run mode, run:');
      console.log('  node src/utils/migrateToAtlas.js "<your-atlas-connection-string>" --dry-run');
      console.log('\nTo run live migration, run:');
      console.log('  node src/utils/migrateToAtlas.js "<your-atlas-connection-string>"');
      console.log('----------------------------------------------------');
      return;
    }

    // Connect to Atlas destination without logging URI or credentials
    console.log('Connecting to MongoDB Atlas destination...');
    atlasConn = await mongoose.createConnection(targetUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    }).asPromise();
    const targetDbName = atlasConn.db.databaseName;
    console.log(` Connected to MongoDB Atlas destination.\n`);

    // 3. Strict database name verification: Abort immediately on mismatch in BOTH modes
    console.log(`Source Database Name:      "${sourceDbName}"`);
    console.log(`Destination Database Name: "${targetDbName}"`);

    if (sourceDbName !== targetDbName) {
      console.error(`\n [ABORTED] Database name mismatch: Source is "${sourceDbName}", but destination is "${targetDbName}".`);
      console.error(` To protect against accidental migration to the wrong database, this operation was aborted.`);
      console.error(` Ensure your Atlas connection string explicitly specifies "/${sourceDbName}" before query parameters.\n`);
      process.exitCode = 1;
      return;
    }
    console.log(' Database names match successfully.\n');

    // 4. Dry-run analysis and preview
    if (isDryRun) {
      console.log('================== DRY-RUN PREVIEW ==================');
      let totalWouldInsert = 0;
      let totalSkipped = 0;

      for (const [colName, docs] of Object.entries(backupData)) {
        const atlasCol = atlasConn.db.collection(colName);
        const atlasCount = await atlasCol.countDocuments();
        const localCount = docs.length;

        if (localCount === 0) {
          console.log(` • ${colName.padEnd(14)}: Local: 0 | Atlas: ${atlasCount} -> [NO DATA IN SOURCE]`);
        } else if (atlasCount > 0) {
          console.log(` • ${colName.padEnd(14)}: Local: ${localCount} | Atlas: ${atlasCount} -> [SKIP] (Atlas collection already contains data)`);
          totalSkipped += localCount;
        } else {
          console.log(` • ${colName.padEnd(14)}: Local: ${localCount} | Atlas: 0 -> [WOULD INSERT] (${localCount} document(s))`);
          totalWouldInsert += localCount;
        }
      }

      console.log('=====================================================');
      console.log(`Summary: ${totalWouldInsert} document(s) would be inserted; ${totalSkipped} document(s) would be skipped.`);
      console.log('DRY-RUN COMPLETE: Zero documents were modified, inserted, or deleted on Atlas.');
      console.log('=====================================================\n');
      return;
    }

    // 5. Live migration path (when --dry-run is absent)
    console.log('--- Migrating Documents to Atlas ---');
    for (const [colName, docs] of Object.entries(backupData)) {
      if (docs.length === 0) continue;
      const atlasCol = atlasConn.db.collection(colName);

      const existingCount = await atlasCol.countDocuments();
      if (existingCount > 0) {
        console.log(` [SKIP] ${colName}: Target collection already contains ${existingCount} doc(s).`);
        continue;
      }

      const insertResult = await atlasCol.insertMany(docs);
      console.log(` [DONE] ${colName}: Inserted ${insertResult.insertedCount} document(s).`);
    }

    console.log('\n====================================================');
    console.log(' Migration to MongoDB Atlas completed successfully!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n================ DIAGNOSTIC ERROR REPORT ================');
    console.error(`Name:           ${err.name || 'N/A'}`);
    console.error(`Code:           ${err.code || 'N/A'}`);
    if (err.hostname) {
      console.error(`Hostname:       ${err.hostname}`);
    }
    if (err.cause) {
      console.error(`Cause Code:     ${err.cause.code || 'N/A'}`);
      if (err.cause.hostname) {
        console.error(`Cause Hostname: ${err.cause.hostname}`);
      }
    }

    if (err.stack) {
      const sanitizedStack = err.stack
        .replace(/mongodb(?:\+srv)?:\/\/[^\s'"`]+/gi, 'mongodb+srv://[REDACTED_USER]:[REDACTED_SECRET]@[REDACTED_HOST]')
        .replace(/:([^\s:@/]+)@/g, ':[REDACTED_SECRET]@');
      console.error('\nStack Trace (Redacted):');
      console.error(sanitizedStack);
    }
    console.error('=========================================================\n');

    if (err.name === 'MongoServerError' && (err.code === 8000 || (err.message && err.message.includes('auth')))) {
      console.error('AUTHENTICATION REJECTED (Atlas Error 8000: bad auth):');
      console.error('Atlas rejected the database credentials.');
      console.error('In MongoDB Atlas -> Security -> Database Access -> verify user password and privileges.\n');
    } else if (err.code === 'ENOTFOUND') {
      console.error('HOSTNAME RESOLUTION ERROR (ENOTFOUND):');
      console.error('The hostname in the connection string could not be resolved by DNS.');
      console.error('Verify the cluster address has the random subdomain: "...xmxqsqz.mongodb.net".\n');
    }

    process.exitCode = 1;
  } finally {
    if (localConn) {
      try { await localConn.close(); } catch (_) {}
    }
    if (atlasConn) {
      try { await atlasConn.close(); } catch (_) {}
    }
  }
}

run();
