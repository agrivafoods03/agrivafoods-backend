import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../public/uploads');

// Initialize S3 client using AWS IAM Role or default credential chain
const s3Client = new S3Client({
  region: env.AWS_REGION || 'ap-southeast-2'
});

export class MediaService {
  static async getAllMedia() {
    let s3Files = [];
    if (env.S3_BUCKET_NAME) {
      try {
        const s3Response = await s3Client.send(new ListObjectsV2Command({
          Bucket: env.S3_BUCKET_NAME,
          Prefix: 'products/',
          MaxKeys: 100
        }));

        if (s3Response.Contents) {
          s3Files = s3Response.Contents.map((obj) => {
            const key = obj.Key;
            const filename = path.basename(key);
            const ext = path.extname(filename).replace('.', '').toLowerCase();
            const fileUrl = env.CLOUDFRONT_URL
              ? `${env.CLOUDFRONT_URL.replace(/\/$/, '')}/${key}`
              : `/api/media/file/${key}`;

            return {
              _id: `s3_${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
              filename,
              url: fileUrl,
              size: obj.Size,
              mimeType: ext === 'svg' ? 'image/svg+xml' : `image/${ext || 'jpeg'}`,
              storage: 's3',
              createdAt: obj.LastModified ? obj.LastModified.toISOString() : new Date().toISOString()
            };
          });
        }
      } catch (err) {
        logger.error(`[MediaService] Error listing S3 objects: ${err.message}`);
      }
    }

    // Scan local upload directory if exists
    let diskFiles = [];
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      diskFiles = files.map((file) => {
        const stats = fs.statSync(path.join(uploadDir, file));
        return {
          _id: `file_${file}`,
          filename: file,
          url: `/uploads/${file}`,
          size: stats.size,
          mimeType: 'image/' + path.extname(file).replace('.', ''),
          storage: 'local',
          createdAt: stats.birthtime.toISOString()
        };
      });
    }

    const existingUrls = new Set([...s3Files.map(f => f.url), ...diskFiles.map(f => f.url)]);
    const combined = [...s3Files, ...diskFiles];
    for (const m of memoryStore.media) {
      if (!existingUrls.has(m.url)) {
        combined.push(m);
      }
    }

    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async registerUploadedFile(file) {
    let fileUrl = `/uploads/${file.filename}`;
    let isS3 = false;

    if (env.S3_BUCKET_NAME) {
      try {
        const fileContent = fs.readFileSync(file.path);
        const s3Key = `products/${file.filename}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: env.S3_BUCKET_NAME,
          Key: s3Key,
          Body: fileContent,
          ContentType: file.mimetype
        }));

        if (env.CLOUDFRONT_URL) {
          fileUrl = `${env.CLOUDFRONT_URL.replace(/\/$/, '')}/${s3Key}`;
        } else {
          fileUrl = `/api/media/file/${s3Key}`;
        }
        isS3 = true;
        logger.info(`[MediaService] Uploaded file to S3: ${s3Key} (${fileUrl})`);

        // Clean up local temp file after successful S3 upload
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch {
          // Local cleanup error is non-critical
        }
      } catch (s3Err) {
        logger.error(`[MediaService] S3 upload failed, keeping local file: ${s3Err.message}`);
        fileUrl = `/uploads/${file.filename}`;
      }
    }

    const mediaItem = {
      _id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      filename: file.filename,
      url: fileUrl,
      size: file.size,
      mimeType: file.mimetype,
      altText: file.originalname,
      storage: isS3 ? 's3' : 'local',
      createdAt: new Date().toISOString()
    };
    memoryStore.media.unshift(mediaItem);
    return mediaItem;
  }

  static async getMediaStream(key) {
    const cleanKey = key.replace(/^\/+/, '');
    const s3Key = cleanKey.startsWith('products/') ? cleanKey : `products/${cleanKey}`;

    if (env.S3_BUCKET_NAME) {
      try {
        const command = new GetObjectCommand({
          Bucket: env.S3_BUCKET_NAME,
          Key: s3Key
        });
        const response = await s3Client.send(command);
        return {
          stream: response.Body,
          contentType: response.ContentType || 'image/jpeg',
          contentLength: response.ContentLength
        };
      } catch (err) {
        logger.warn(`[MediaService] S3 getObject failed for ${s3Key}: ${err.message}`);
      }
    }

    // Disk fallback
    const localFile = path.join(uploadDir, path.basename(cleanKey));
    if (fs.existsSync(localFile)) {
      const ext = path.extname(localFile).replace('.', '').toLowerCase();
      return {
        stream: fs.createReadStream(localFile),
        contentType: ext === 'svg' ? 'image/svg+xml' : `image/${ext || 'jpeg'}`,
        contentLength: fs.statSync(localFile).size
      };
    }

    throw new ApiError(404, `Image not found: ${cleanKey}`);
  }

  static async deleteMedia(filename) {
    const rawName = path.basename(filename);

    if (env.S3_BUCKET_NAME) {
      try {
        const s3Key = filename.startsWith('products/') ? filename : `products/${rawName}`;
        await s3Client.send(new DeleteObjectCommand({
          Bucket: env.S3_BUCKET_NAME,
          Key: s3Key
        }));
        logger.info(`[MediaService] Deleted object from S3: ${s3Key}`);
      } catch (err) {
        logger.warn(`[MediaService] S3 deletion error: ${err.message}`);
      }
    }

    const filePath = path.join(uploadDir, rawName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        throw new ApiError(500, `Failed to delete file from disk: ${err.message}`);
      }
    }

    const idx = memoryStore.media.findIndex(m => m.filename === rawName || m.url.includes(rawName));
    if (idx !== -1) {
      memoryStore.media.splice(idx, 1);
    }

    return { success: true, message: `Image ${rawName} deleted successfully` };
  }
}
