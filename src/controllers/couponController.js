import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { CouponService } from '../services/couponService.js';

export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, subtotal } = req.body;
  const result = await CouponService.validateCoupon(code, Number(subtotal) || 0);
  return ApiResponse.success(res, result, 'Coupon applied successfully');
});

export const getAllCoupons = asyncHandler(async (req, res) => {
  const coupons = await CouponService.getAllCoupons();
  return ApiResponse.success(res, coupons, 'Coupons retrieved successfully');
});

export const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await CouponService.createCoupon(req.body);
  return ApiResponse.created(res, coupon, 'Coupon created successfully');
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  const result = await CouponService.deleteCoupon(req.params.id);
  return ApiResponse.success(res, result, 'Coupon deleted successfully');
});
