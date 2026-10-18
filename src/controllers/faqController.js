import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { FAQService } from '../services/faqService.js';

export const getFAQs = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const faqs = await FAQService.getAllFAQs({ category });
  return ApiResponse.success(res, faqs, 'FAQs retrieved successfully');
});

export const createFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQService.createFAQ(req.body);
  return ApiResponse.created(res, faq, 'FAQ created successfully');
});

export const updateFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQService.updateFAQ(req.params.id, req.body);
  return ApiResponse.success(res, faq, 'FAQ updated successfully');
});

export const deleteFAQ = asyncHandler(async (req, res) => {
  const result = await FAQService.deleteFAQ(req.params.id);
  return ApiResponse.success(res, result, 'FAQ deleted successfully');
});
