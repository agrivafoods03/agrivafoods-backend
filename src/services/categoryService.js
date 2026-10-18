import { Category } from '../models/Category.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';

export class CategoryService {
  static async getAllCategories({ onlyActive = false } = {}) {
    if (checkDbConnection()) {
      const query = onlyActive ? { isActive: true } : {};
      return await Category.find(query).sort({ order: 1, createdAt: -1 });
    } else {
      let list = memoryStore.categories;
      if (onlyActive) list = list.filter(c => c.isActive);
      return list.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  }

  static async getCategoryBySlug(slug) {
    if (checkDbConnection()) {
      const cat = await Category.findOne({ slug });
      if (!cat) throw new ApiError(404, `Category '${slug}' not found.`);
      return cat;
    } else {
      const cat = memoryStore.categories.find(c => c.slug === slug);
      if (!cat) throw new ApiError(404, `Category '${slug}' not found.`);
      return cat;
    }
  }

  static async createCategory(data) {
    const { name, slug, description, image, order } = data;
    if (!name) throw new ApiError(400, 'Category name is required.');
    const catSlug = (slug || name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (checkDbConnection()) {
      const existing = await Category.findOne({ slug: catSlug });
      if (existing) throw new ApiError(409, `Category '${catSlug}' already exists.`);
      return await Category.create({ name, slug: catSlug, description, image, order: order || 0 });
    } else {
      const existing = memoryStore.categories.find(c => c.slug === catSlug);
      if (existing) throw new ApiError(409, `Category '${catSlug}' already exists.`);
      const newCat = {
        _id: `cat_${Date.now()}`,
        name,
        slug: catSlug,
        description: description || '',
        image: image || null,
        order: order || memoryStore.categories.length + 1,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      memoryStore.categories.push(newCat);
      return newCat;
    }
  }

  static async updateCategory(id, data) {
    if (checkDbConnection()) {
      const cat = await Category.findByIdAndUpdate(id, data, { new: true });
      if (!cat) throw new ApiError(404, 'Category not found.');
      return cat;
    } else {
      const idx = memoryStore.categories.findIndex(c => c._id === id || c.id === id);
      if (idx === -1) throw new ApiError(404, 'Category not found.');
      memoryStore.categories[idx] = {
        ...memoryStore.categories[idx],
        ...data,
        updatedAt: new Date().toISOString()
      };
      return memoryStore.categories[idx];
    }
  }

  static async deleteCategory(id) {
    if (checkDbConnection()) {
      const cat = await Category.findByIdAndDelete(id);
      if (!cat) throw new ApiError(404, 'Category not found.');
      return { success: true, message: 'Category deleted' };
    } else {
      const idx = memoryStore.categories.findIndex(c => c._id === id || c.id === id);
      if (idx === -1) throw new ApiError(404, 'Category not found.');
      memoryStore.categories.splice(idx, 1);
      return { success: true, message: 'Category deleted' };
    }
  }
}
