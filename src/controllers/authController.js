import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { AuthService } from '../services/authService.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const result = await AuthService.register({ name, email, password, phone });
  return ApiResponse.created(res, result, 'User registered successfully');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await AuthService.login({ email, password });
  return ApiResponse.success(res, result, 'Login successful');
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await AuthService.getCurrentUser(req.user._id || req.user.id);
  return ApiResponse.success(res, user, 'Profile fetched successfully');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await AuthService.changePassword(req.user._id || req.user.id, currentPassword, newPassword);
  return ApiResponse.success(res, result, 'Password changed successfully');
});

export const logout = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, null, 'Logged out successfully');
});
