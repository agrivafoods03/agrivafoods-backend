import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { DashboardService } from '../services/dashboardService.js';

export const getStats = asyncHandler(async (req, res) => {
  const stats = await DashboardService.getStats();
  return ApiResponse.success(res, stats, 'Dashboard analytics retrieved successfully');
});
