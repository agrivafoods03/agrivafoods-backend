import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const uri = process.env.ATLAS_MONGODB_URI || process.env.MONGODB_URI;

async function testConnection() {
  console.log('====================================================');
  console.log(' AgrivaFoods MongoDB Atlas Connection Validator');
  console.log('====================================================\n');

  if (!uri || uri.includes('localhost') || uri.includes('127.0.0.1')) {
    console.error(' [ERROR] ATLAS_MONGODB_URI is not set in backend/.env.');
    console.error(' Please set ATLAS_MONGODB_URI in backend/.env with your Atlas connection string.');
    process.exit(1);
  }

  console.log('Testing connection to MongoDB Atlas...');
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });

    console.log(' [SUCCESS] Connected to MongoDB Atlas!');
    console.log(` Database Name: "${conn.connection.name}"`);
    console.log(` Host:          ${conn.connection.host}`);
    console.log(` Ready State:   ${conn.connection.readyState === 1 ? 'Connected (1)' : 'Not ready'}\n`);

    const collections = await conn.connection.db.listCollections().toArray();
    console.log(` Collections found on Atlas (${collections.length}):`);
    if (collections.length === 0) {
      console.log('  (Clean database: zero collections present)');
    } else {
      for (const c of collections) {
        const count = await conn.connection.db.collection(c.name).countDocuments();
        console.log(`  • ${c.name.padEnd(15)}: ${count} document(s)`);
      }
    }

    await mongoose.disconnect();
    console.log('\n====================================================');
    console.log(' Atlas connection test passed completely!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n [CONNECTION FAILED]');
    console.error(` Error Name: ${err.name}`);
    console.error(` Error Code: ${err.code || 'N/A'}`);
    const safeMsg = (err.message || '').replace(/\/\/.*@/, '//[REDACTED]@');
    console.error(` Message:    ${safeMsg}\n`);

    if (err.name === 'MongoServerError' && err.code === 8000) {
      console.error('DIAGNOSIS: Authentication failed (Atlas Code 8000).');
      console.error('Atlas rejected your database username or password.');
      console.error('Action: In Atlas -> Security -> Database Access:');
      console.error('1. Check the database username.');
      console.error('2. Reset/update the password and ensure privileges are "Read and write to any database".');
      console.error('3. Update ATLAS_MONGODB_URI in backend/.env with the new password.');
    } else if (err.code === 'ENOTFOUND') {
      console.error('DIAGNOSIS: Hostname resolution failed (ENOTFOUND).');
      console.error('Check that the cluster hostname in backend/.env includes your random cluster subdomain (e.g. .xmxqsqz.mongodb.net).');
    }
    process.exit(1);
  }
}

testConnection();
