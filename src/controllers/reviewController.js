import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ReviewService } from '../services/reviewService.js';

export const getReviews = asyncHandler(async (req, res) => {
  const { productName, status, page, limit } = req.query;
  const result = await ReviewService.getReviews({ productName, status, page, limit });
  return ApiResponse.success(res, result.reviews, 'Reviews retrieved successfully', 200, {
    total: result.total,
    page: result.page,
    pages: result.pages
  });
});

export const createReview = asyncHandler(async (req, res) => {
  const userId = req.user ? (req.user._id || req.user.id) : null;
  const review = await ReviewService.createReview(req.body, userId);
  return ApiResponse.created(res, review, 'Review submitted successfully');
});

export const upvoteReview = asyncHandler(async (req, res) => {
  const review = await ReviewService.upvoteReview(req.params.id);
  return ApiResponse.success(res, review, 'Review upvoted successfully');
});

export const updateReviewStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const review = await ReviewService.updateReviewStatus(req.params.id, status);
  return ApiResponse.success(res, review, 'Review status updated');
});

export const deleteReview = asyncHandler(async (req, res) => {
  const result = await ReviewService.deleteReview(req.params.id);
  return ApiResponse.success(res, result, 'Review deleted successfully');
});
