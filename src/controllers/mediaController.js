import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { MediaService } from '../services/mediaService.js';

export const getAllMedia = asyncHandler(async (req, res) => {
  const media = await MediaService.getAllMedia();
  return ApiResponse.success(res, media, 'Media items retrieved');
});

export const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file && (!req.files || req.files.length === 0)) {
    throw new ApiError(400, 'Please select at least one image file to upload.');
  }

  if (req.files && req.files.length > 0) {
    const uploaded = await Promise.all(req.files.map(f => MediaService.registerUploadedFile(f)));
    return ApiResponse.created(res, uploaded, `${uploaded.length} image(s) uploaded successfully`);
  }

  const uploaded = await MediaService.registerUploadedFile(req.file);
  return ApiResponse.created(res, uploaded, 'Image uploaded successfully');
});

export const deleteMedia = asyncHandler(async (req, res) => {
  const result = await MediaService.deleteMedia(req.params.filename);
  return ApiResponse.success(res, result, 'Image deleted successfully');
});

export const streamMedia = asyncHandler(async (req, res) => {
  const key = req.params[0] || req.params.key;
  if (!key) {
    throw new ApiError(400, 'Image key is required');
  }

  const { stream, contentType, contentLength } = await MediaService.getMediaStream(key);
  res.setHeader('Content-Type', contentType);
  if (contentLength) res.setHeader('Content-Length', contentLength);
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  stream.pipe(res);
});