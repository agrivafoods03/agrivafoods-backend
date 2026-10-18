import { Product } from '../models/Product.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';
import { emailService } from './emailService.js';
import { logger } from '../utils/logger.js';

export class ProductService {
  static async getAllProducts({
    search,
    category,
    sort,
    featured,
    page = 1,
    limit = 50,
    includeInactive = false,
    stockStatus,
    status
  }) {
    if (checkDbConnection()) {
      const query = {};

      if (!includeInactive) {
        query.isActive = true;
        query.status = 'published';
      } else if (status && status !== 'all') {
        query.status = status;
      }

      if (category && category !== 'All') {
        query.category = { $regex: new RegExp(`^${category}$`, 'i') };
      }

      if (featured !== undefined && featured !== '') {
        query.featured = featured === 'true' || featured === true;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { 'variants.sku': { $regex: search, $options: 'i' } }
        ];
      }

      if (stockStatus === 'in_stock') {
        query['variants.stock'] = { $gt: 0 };
      } else if (stockStatus === 'out_of_stock') {
        query['variants.stock'] = { $eq: 0 };
      }

      let sortOption = { createdAt: -1 };
      if (sort === 'price-asc') sortOption = { 'variants.0.price': 1 };
      else if (sort === 'price-desc') sortOption = { 'variants.0.price': -1 };
      else if (sort === 'rating') sortOption = { rating: -1 };
      else if (sort === 'name') sortOption = { name: 1 };
      else if (sort === 'oldest') sortOption = { createdAt: 1 };

      const skip = (page - 1) * limit;
      const total = await Product.countDocuments(query);
      const products = await Product.find(query).sort(sortOption).skip(skip).limit(Number(limit));

      return {
        products,
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      };
    } else {
      // In-Memory Mode
      let list = [...memoryStore.products];

      if (!includeInactive) {
        list = list.filter(p => (p.isActive !== false) && (p.status === 'published' || !p.status));
      } else if (status && status !== 'all') {
        list = list.filter(p => p.status === status);
      }

      if (category && category !== 'All') {
        list = list.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }

      if (featured !== undefined && featured !== '') {
        const isFeat = featured === 'true' || featured === true;
        list = list.filter(p => p.featured === isFeat);
      }

      if (search) {
        const q = search.toLowerCase();
        list = list.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.variants && p.variants.some(v => v.sku?.toLowerCase().includes(q) || v.weight?.toLowerCase().includes(q)))
        );
      }

      if (stockStatus === 'in_stock') {
        list = list.filter(p => p.variants?.some(v => v.stock > 0));
      } else if (stockStatus === 'out_of_stock') {
        list = list.filter(p => p.variants?.every(v => v.stock === 0));
      } else if (stockStatus === 'low_stock') {
        list = list.filter(p => p.variants?.some(v => v.stock <= 10));
      }

      if (sort === 'price-asc') {
        list.sort((a, b) => (a.variants?.[0]?.price || 0) - (b.variants?.[0]?.price || 0));
      } else if (sort === 'price-desc') {
        list.sort((a, b) => (b.variants?.[0]?.price || 0) - (a.variants?.[0]?.price || 0));
      } else if (sort === 'rating') {
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (sort === 'name') {
        list.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sort === 'oldest') {
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      } else {
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      const total = list.length;
      const skip = (page - 1) * limit;
      const products = list.slice(skip, skip + Number(limit));

      return {
        products,
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      };
    }
  }

  static async getProductBySlug(slug, includeInactive = false) {
    if (checkDbConnection()) {
      const query = { slug };
      if (!includeInactive) {
        query.isActive = true;
        query.status = 'published';
      }
      const product = await Product.findOne(query);
      if (!product) throw new ApiError(404, `Product '${slug}' not found.`);
      return product;
    } else {
      const product = memoryStore.products.find(p => p.slug === slug);
      if (!product || (!includeInactive && (product.isActive === false || product.status !== 'published'))) {
        throw new ApiError(404, `Product '${slug}' not found.`);
      }
      return product;
    }
  }

  static async getProductById(id, includeInactive = false) {
    if (checkDbConnection()) {
      const query = { _id: id };
      if (!includeInactive) {
        query.isActive = true;
        query.status = 'published';
      }
      const product = await Product.findOne(query);
      if (!product) throw new ApiError(404, 'Product not found.');
      return product;
    } else {
      const product = memoryStore.products.find(p => p._id === id || p.id === id);
      if (!product || (!includeInactive && (product.isActive === false || product.status !== 'published'))) {
        throw new ApiError(404, 'Product not found.');
      }
      return product;
    }
  }

  static async createProduct(productData) {
    if (!productData.name) {
      throw new ApiError(400, 'Product name is required.');
    }

    const slug = (productData.slug || productData.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const payload = {
      ...productData,
      slug,
      isActive: productData.isActive !== undefined ? productData.isActive : true,
      status: productData.status || 'published',
      rating: productData.rating || 5.0,
      reviewCount: productData.reviewCount || 0,
      variants: (productData.variants || []).map((v, i) => ({
        ...v,
        sku: v.sku || `AGR-${slug.substring(0, 3).toUpperCase()}-${v.weight || i + 1}`,
        stock: Number(v.stock) || 0,
        price: Number(v.price) || 0,
        originalPrice: Number(v.originalPrice || v.price) || 0,
        inStock: (Number(v.stock) || 0) > 0
      }))
    };

    payload.inStock = payload.variants.some(v => v.stock > 0);

    let createdProduct = null;
    if (checkDbConnection()) {
      const existing = await Product.findOne({ slug });
      if (existing) throw new ApiError(409, `Product with slug '${slug}' already exists.`);
      createdProduct = await Product.create(payload);
    } else {
      const existing = memoryStore.products.find(p => p.slug === slug);
      if (existing) throw new ApiError(409, `Product with slug '${slug}' already exists.`);

      createdProduct = {
        _id: `prod_${Date.now()}`,
        id: `prod_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      memoryStore.products.unshift(createdProduct);
    }

    // Automatic Admin Email Notification (non-blocking)
    emailService.sendProductCreatedNotification(createdProduct).catch(err => {
      logger.error(`[ProductService] Failed to send product created notification: ${err.message}`);
    });

    return createdProduct;
  }

  static async updateProduct(id, updateData) {
    // 1. Fetch current product state to compute changes diff
    let existingProduct = null;
    try {
      existingProduct = await this.getProductById(id, true);
    } catch {
      // If not found, will fail below
    }

    if (updateData.slug) {
      updateData.slug = updateData.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    if (updateData.variants && Array.isArray(updateData.variants)) {
      updateData.variants = updateData.variants.map((v) => ({
        ...v,
        stock: Number(v.stock) || 0,
        price: Number(v.price) || 0,
        originalPrice: Number(v.originalPrice || v.price) || 0,
        inStock: (Number(v.stock) || 0) > 0
      }));
      updateData.inStock = updateData.variants.some(v => v.stock > 0);
    }

    // 2. Compute notable changes
    const changes = [];
    if (existingProduct) {
      if (updateData.name && updateData.name !== existingProduct.name) {
        changes.push({ field: 'Product Name', oldValue: existingProduct.name, newValue: updateData.name });
      }
      if (updateData.status && updateData.status !== existingProduct.status) {
        changes.push({ field: 'Status', oldValue: existingProduct.status, newValue: updateData.status });
      }
      if (updateData.isActive !== undefined && updateData.isActive !== existingProduct.isActive) {
        changes.push({ field: 'Active Flag', oldValue: String(existingProduct.isActive), newValue: String(updateData.isActive) });
      }
      if (updateData.category && updateData.category !== existingProduct.category) {
        changes.push({ field: 'Category', oldValue: existingProduct.category, newValue: updateData.category });
      }
      if (updateData.featured !== undefined && updateData.featured !== existingProduct.featured) {
        changes.push({ field: 'Featured', oldValue: String(existingProduct.featured), newValue: String(updateData.featured) });
      }
      if (updateData.description && updateData.description !== existingProduct.description) {
        changes.push({
          field: 'Description',
          oldValue: existingProduct.description ? `${existingProduct.description.substring(0, 45)}...` : '(empty)',
          newValue: `${updateData.description.substring(0, 45)}...`
        });
      }
      if (updateData.variants && Array.isArray(updateData.variants)) {
        const oldVariants = existingProduct.variants || [];
        updateData.variants.forEach(nv => {
          const ov = oldVariants.find(o => o.sku === nv.sku || o.weight === nv.weight);
          if (ov) {
            if (Number(ov.price) !== Number(nv.price)) {
              changes.push({
                field: `Price (${nv.weight || nv.sku})`,
                oldValue: `₹${ov.price}`,
                newValue: `₹${nv.price}`
              });
            }
            if (Number(ov.stock) !== Number(nv.stock)) {
              changes.push({
                field: `Stock (${nv.weight || nv.sku})`,
                oldValue: `${ov.stock} units`,
                newValue: `${nv.stock} units`
              });
            }
          } else {
            changes.push({
              field: `New Variant (${nv.weight || nv.sku})`,
              oldValue: '(none)',
              newValue: `₹${nv.price}, Stock: ${nv.stock}`
            });
          }
        });
      }
    }

    let updatedProduct = null;
    if (checkDbConnection()) {
      updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
      if (!updatedProduct) throw new ApiError(404, 'Product not found.');
    } else {
      const index = memoryStore.products.findIndex(p => p._id === id || p.id === id);
      if (index === -1) throw new ApiError(404, 'Product not found.');

      memoryStore.products[index] = {
        ...memoryStore.products[index],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      updatedProduct = memoryStore.products[index];
    }

    // Send notification only if meaningful changes occurred (non-blocking)
    if (changes.length > 0) {
      emailService.sendProductUpdatedNotification(updatedProduct, changes).catch(err => {
        logger.error(`[ProductService] Failed to send product updated notification: ${err.message}`);
      });
    }

    return updatedProduct;
  }

  static async deleteProduct(id) {
    // Soft delete: set status to archived and isActive to false
    return await this.updateProduct(id, { isActive: false, status: 'archived' });
  }

  static async togglePublish(id) {
    const product = await this.getProductById(id, true);
    const newStatus = product.status === 'published' ? 'draft' : 'published';
    const newActive = newStatus === 'published';
    return await this.updateProduct(id, { status: newStatus, isActive: newActive });
  }

  static async toggleFeatured(id) {
    const product = await this.getProductById(id, true);
    return await this.updateProduct(id, { featured: !product.featured });
  }

  static async getAllInventory() {
    let products = [];
    if (checkDbConnection()) {
      products = await Product.find().select('name slug sku category variants inStock isActive');
    } else {
      products = memoryStore.products;
    }

    const inventoryList = [];
    for (const p of products) {
      const variants = p.variants || [];
      for (const v of variants) {
        inventoryList.push({
          productId: p._id || p.id,
          productName: p.name,
          productSlug: p.slug,
          category: p.category,
          variantId: v._id || v.sku,
          sku: v.sku,
          weight: v.weight,
          price: v.price,
          originalPrice: v.originalPrice,
          stock: v.stock || 0,
          isPopular: v.isPopular || false,
          isLowStock: (v.stock || 0) <= 10 && (v.stock || 0) > 0,
          isOutOfStock: (v.stock || 0) === 0,
          productStatus: p.status || (p.isActive ? 'published' : 'draft')
        });
      }
    }

    return inventoryList;
  }

  static async updateVariantStock(productId, sku, { stock, price, originalPrice }) {
    const product = await this.getProductById(productId, true);
    const variants = product.variants ? [...product.variants] : [];
    const variantIndex = variants.findIndex(v => v.sku === sku);

    if (variantIndex === -1) {
      throw new ApiError(404, `Variant with SKU '${sku}' not found in product.`);
    }

    const updatedVariant = { ...variants[variantIndex] };
    if (stock !== undefined) {
      updatedVariant.stock = Number(stock);
      updatedVariant.inStock = Number(stock) > 0;
    }
    if (price !== undefined) updatedVariant.price = Number(price);
    if (originalPrice !== undefined) updatedVariant.originalPrice = Number(originalPrice);

    variants[variantIndex] = updatedVariant;
    return await this.updateProduct(productId, { variants });
  }

  static async getCategories() {
    if (checkDbConnection()) {
      return await Product.distinct('category', { isActive: true });
    } else {
      const cats = new Set(memoryStore.products.filter(p => p.isActive !== false).map(p => p.category));
      return Array.from(cats);
    }
  }
}
