import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { PaymentService } from '../services/paymentService.js';
import { ApiError } from '../utils/ApiError.js';

export const getPaymentConfig = asyncHandler(async (req, res) => {
  const config = PaymentService.getPublicConfig();
  return ApiResponse.success(res, config, 'Payment gateway configuration retrieved');
});

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const userId = req.user ? (req.user._id || req.user.id) : null;
  const result = await PaymentService.createOrderWithRazorpay(req.body, userId);
  return ApiResponse.created(res, result, 'Order and Razorpay session created successfully');
});

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const completedOrder = await PaymentService.verifyPaymentAndCompleteOrder({
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  });
  return ApiResponse.success(res, completedOrder, 'Payment verified and order confirmed successfully');
});

export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (!signature) {
    throw new ApiError(400, 'Missing X-Razorpay-Signature header in webhook request');
  }

  const result = await PaymentService.handleWebhookEvent(rawBody, signature);
  return res.status(200).json({ success: true, result });
});
