import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { HomepageService } from '../services/homepageService.js';

export const getHomepageConfig = asyncHandler(async (req, res) => {
  const config = await HomepageService.getHomepage();
  return ApiResponse.success(res, config, 'Homepage configuration retrieved');
});

export const updateHomepageConfig = asyncHandler(async (req, res) => {
  const config = await HomepageService.updateHomepage(req.body);
  return ApiResponse.success(res, config, 'Homepage configuration updated successfully');
});
