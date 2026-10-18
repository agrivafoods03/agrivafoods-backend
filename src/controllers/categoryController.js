import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { CategoryService } from '../services/categoryService.js';

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await CategoryService.getAllCategories({ onlyActive: false });
  return ApiResponse.success(res, categories, 'Categories retrieved');
});

export const getPublicCategories = asyncHandler(async (req, res) => {
  const categories = await CategoryService.getAllCategories({ onlyActive: true });
  return ApiResponse.success(res, categories, 'Active categories retrieved');
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await CategoryService.createCategory(req.body);
  return ApiResponse.created(res, category, 'Category created successfully');
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await CategoryService.updateCategory(req.params.id, req.body);
  return ApiResponse.success(res, category, 'Category updated successfully');
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const result = await CategoryService.deleteCategory(req.params.id);
  return ApiResponse.success(res, result, 'Category deleted successfully');
});
