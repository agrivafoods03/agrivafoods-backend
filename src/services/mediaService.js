import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../public/uploads');

export class MediaService {
  static async getAllMedia() {
    // Scan upload directory if exists
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
          createdAt: stats.birthtime.toISOString()
        };
      });
    }

    // Combine with memoryStore.media without duplicates
    const existingUrls = new Set(diskFiles.map(f => f.url));
    const combined = [...diskFiles];
    for (const m of memoryStore.media) {
      if (!existingUrls.has(m.url)) {
        combined.push(m);
      }
    }

    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async registerUploadedFile(file) {
    const mediaItem = {
      _id: `media_${Date.now()}`,
      filename: file.filename,
      url: `/uploads/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype,
      altText: file.originalname,
      createdAt: new Date().toISOString()
    };
    memoryStore.media.unshift(mediaItem);
    return mediaItem;
  }

  static async deleteMedia(filename) {
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        throw new ApiError(500, `Failed to delete file from disk: ${err.message}`);
      }
    }

    const idx = memoryStore.media.findIndex(m => m.filename === filename || m.url.includes(filename));
    if (idx !== -1) {
      memoryStore.media.splice(idx, 1);
    }

    return { success: true, message: `Image ${filename} deleted successfully` };
  }
}
