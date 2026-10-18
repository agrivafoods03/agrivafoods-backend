import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ProductService } from '../services/productService.js';

export const getProducts = asyncHandler(async (req, res) => {
  const { search, category, sort, featured, page, limit, status, stockStatus } = req.query;
  const includeInactive = req.user && req.user.role === 'admin';
  const result = await ProductService.getAllProducts({
    search,
    category,
    sort,
    featured,
    page,
    limit,
    includeInactive,
    status,
    stockStatus
  });

  return ApiResponse.success(res, result.products, 'Products retrieved successfully', 200, {
    total: result.total,
    page: result.page,
    pages: result.pages
  });
});

export const getAdminProducts = asyncHandler(async (req, res) => {
  const { search, category, sort, featured, page, limit, status, stockStatus } = req.query;
  const result = await ProductService.getAllProducts({
    search,
    category,
    sort,
    featured,
    page,
    limit,
    includeInactive: true,
    status,
    stockStatus
  });

  return ApiResponse.success(res, result.products, 'Admin products retrieved successfully', 200, {
    total: result.total,
    page: result.page,
    pages: result.pages
  });
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const includeInactive = req.user && req.user.role === 'admin';
  const product = await ProductService.getProductBySlug(req.params.slug, includeInactive);
  return ApiResponse.success(res, product, 'Product retrieved successfully');
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await ProductService.getProductById(req.params.id);
  return ApiResponse.success(res, product, 'Product retrieved successfully');
});

export const createProduct = asyncHandler(async (req, res) => {
  const product = await ProductService.createProduct(req.body);
  return ApiResponse.created(res, product, 'Product created successfully');
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await ProductService.updateProduct(req.params.id, req.body);
  return ApiResponse.success(res, product, 'Product updated successfully');
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const result = await ProductService.deleteProduct(req.params.id);
  return ApiResponse.success(res, result, 'Product archived successfully');
});

export const togglePublish = asyncHandler(async (req, res) => {
  const product = await ProductService.togglePublish(req.params.id);
  return ApiResponse.success(res, product, `Product is now ${product.status}`);
});

export const toggleFeatured = asyncHandler(async (req, res) => {
  const product = await ProductService.toggleFeatured(req.params.id);
  return ApiResponse.success(res, product, `Product featured status updated to ${product.featured}`);
});

export const getInventory = asyncHandler(async (req, res) => {
  const inventory = await ProductService.getAllInventory();
  return ApiResponse.success(res, inventory, 'Inventory items retrieved');
});

export const updateVariantStock = asyncHandler(async (req, res) => {
  const { productId, sku } = req.params;
  const { stock, price, originalPrice } = req.body;
  const product = await ProductService.updateVariantStock(productId, sku, { stock, price, originalPrice });
  return ApiResponse.success(res, product, `Stock for variant ${sku} updated successfully`);
});

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await ProductService.getCategories();
  return ApiResponse.success(res, categories, 'Categories retrieved successfully');
});
