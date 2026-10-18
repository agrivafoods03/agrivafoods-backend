import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { OrderService } from '../services/orderService.js';

export const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user ? (req.user._id || req.user.id) : null;
  const order = await OrderService.createOrder(req.body, userId);
  return ApiResponse.created(res, order, 'Order created successfully');
});

export const getOrderById = asyncHandler(async (req, res) => {
  const userId = req.user && req.user.role !== 'admin' ? (req.user._id || req.user.id) : null;
  const order = await OrderService.getOrderById(req.params.id, userId);
  return ApiResponse.success(res, order, 'Order retrieved successfully');
});

export const getOrderByNumber = asyncHandler(async (req, res) => {
  const order = await OrderService.getOrderByNumber(req.params.orderNumber);
  return ApiResponse.success(res, order, 'Order tracking details retrieved');
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const orders = await OrderService.getUserOrders(userId);
  return ApiResponse.success(res, orders, 'Orders retrieved successfully');
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const { page, limit, status, search } = req.query;
  const result = await OrderService.getAllOrders({ page, limit, status, search });
  return ApiResponse.success(res, result.orders, 'All orders retrieved successfully', 200, {
    total: result.total,
    page: result.page,
    pages: result.pages
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, paymentStatus, trackingNumber } = req.body;
  const order = await OrderService.updateOrderStatus(req.params.id, { orderStatus, paymentStatus, trackingNumber });
  return ApiResponse.success(res, order, 'Order status updated successfully');
});
