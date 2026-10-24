import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const getPaymentConfig = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, {
    onlinePaymentEnabled: false,
    activePaymentMethod: 'COD',
    paymentMethods: ['COD'],
    currency: 'INR',
    message: 'Online payment gateway is temporarily disabled. AgrivaFoods currently accepts Cash on Delivery (COD) only.'
  }, 'Payment gateway configuration retrieved');
});

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  throw new ApiError(
    400,
    'Online payment gateway is temporarily disabled. Please place your order using Cash on Delivery (COD) via /api/orders.'
  );
});

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  throw new ApiError(
    400,
    'Online payment verification is disabled. Cash on Delivery is currently the active payment method.'
  );
});

export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  logger.info('[Razorpay Webhook] Webhook event received during COD-only mode (paused).');
  return res.status(200).json({
    success: true,
    message: 'Webhook received. Online payment processing is currently paused in COD-only mode.'
  });
});
