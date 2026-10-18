import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { UserService } from '../services/userService.js';

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await UserService.getProfile(req.user._id || req.user.id);
  return ApiResponse.success(res, profile, 'User profile retrieved');
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updated = await UserService.updateProfile(req.user._id || req.user.id, req.body);
  return ApiResponse.success(res, updated, 'Profile updated successfully');
});

export const addAddress = asyncHandler(async (req, res) => {
  const addresses = await UserService.addAddress(req.user._id || req.user.id, req.body);
  return ApiResponse.created(res, addresses, 'Address added successfully');
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const addresses = await UserService.deleteAddress(req.user._id || req.user.id, req.params.addressId);
  return ApiResponse.success(res, addresses, 'Address deleted successfully');
});

export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await UserService.getWishlist(req.user._id || req.user.id);
  return ApiResponse.success(res, wishlist, 'Wishlist retrieved successfully');
});

export const toggleWishlist = asyncHandler(async (req, res) => {
  const { productSlug } = req.body;
  const result = await UserService.toggleWishlist(req.user._id || req.user.id, productSlug);
  return ApiResponse.success(res, result, result.inWishlist ? 'Added to wishlist' : 'Removed from wishlist');
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const result = await UserService.getAllUsers({ page, limit, search });
  return ApiResponse.success(res, result.users, 'Users retrieved successfully', 200, {
    total: result.total,
    page: result.page,
    pages: result.pages
  });
});
