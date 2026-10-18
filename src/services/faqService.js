import { FAQ } from '../models/FAQ.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';

export class FAQService {
  static async getAllFAQs({ category } = {}) {
    if (checkDbConnection()) {
      const query = { isActive: true };
      if (category && category !== 'All') {
        query.category = { $regex: new RegExp(`^${category}$`, 'i') };
      }
      return await FAQ.find(query).sort({ order: 1, createdAt: 1 });
    } else {
      let list = memoryStore.faqs.filter(f => f.isActive !== false);
      if (category && category !== 'All') {
        list = list.filter(f => f.category.toLowerCase() === category.toLowerCase());
      }
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      return list;
    }
  }

  static async createFAQ(faqData) {
    const { question, answer, category, order } = faqData;
    if (!question || !answer) {
      throw new ApiError(400, 'Question and answer are required.');
    }

    if (checkDbConnection()) {
      return await FAQ.create({ question, answer, category, order: order || 0 });
    } else {
      const newFaq = {
        _id: `faq_${Date.now()}`,
        question,
        answer,
        category: category || 'General',
        order: order || 0,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      memoryStore.faqs.push(newFaq);
      return newFaq;
    }
  }

  static async updateFAQ(id, updateData) {
    if (checkDbConnection()) {
      const faq = await FAQ.findByIdAndUpdate(id, updateData, { new: true });
      if (!faq) throw new ApiError(404, 'FAQ not found.');
      return faq;
    } else {
      const faq = memoryStore.faqs.find(f => f._id === id || f.id === id);
      if (!faq) throw new ApiError(404, 'FAQ not found.');
      Object.assign(faq, updateData);
      return faq;
    }
  }

  static async deleteFAQ(id) {
    if (checkDbConnection()) {
      const res = await FAQ.findByIdAndDelete(id);
      if (!res) throw new ApiError(404, 'FAQ not found.');
      return { success: true, message: 'FAQ deleted successfully' };
    } else {
      const idx = memoryStore.faqs.findIndex(f => f._id === id || f.id === id);
      if (idx === -1) throw new ApiError(404, 'FAQ not found.');
      memoryStore.faqs.splice(idx, 1);
      return { success: true, message: 'FAQ deleted successfully' };
    }
  }
}
