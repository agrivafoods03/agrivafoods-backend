import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { NewsletterService } from '../services/newsletterService.js';

export const subscribe = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await NewsletterService.subscribe(email);
  return ApiResponse.success(res, null, result.message);
});

export const unsubscribe = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await NewsletterService.unsubscribe(email);
  return ApiResponse.success(res, null, result.message);
});

export const getSubscribers = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await NewsletterService.getAllSubscribers({ page, limit });
  return ApiResponse.success(res, result.subscribers, 'Subscribers retrieved', 200, {
    total: result.total,
    page: result.page,
    pages: result.pages
  });
});
