import { Newsletter } from '../models/Newsletter.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';

export class NewsletterService {
  static async subscribe(email) {
    if (!email) throw new ApiError(400, 'Email address is required.');
    const normalized = email.toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      throw new ApiError(400, 'Please provide a valid email address.');
    }

    if (checkDbConnection()) {
      const existing = await Newsletter.findOne({ email: normalized });
      if (existing) {
        if (!existing.isActive) {
          existing.isActive = true;
          await existing.save();
          return { message: 'Subscription reactivated successfully!' };
        }
        return { message: 'You are already subscribed to our newsletter.' };
      }
      await Newsletter.create({ email: normalized });
      return { message: 'Thank you for subscribing to AgrivaFoods updates & recipes!' };
    } else {
      const existing = memoryStore.newsletters.find(n => n.email === normalized);
      if (existing) {
        if (!existing.isActive) {
          existing.isActive = true;
          return { message: 'Subscription reactivated successfully!' };
        }
        return { message: 'You are already subscribed to our newsletter.' };
      }
      memoryStore.newsletters.push({
        _id: `news_${Date.now()}`,
        email: normalized,
        isActive: true,
        subscribedAt: new Date().toISOString()
      });
      return { message: 'Thank you for subscribing to AgrivaFoods updates & recipes!' };
    }
  }

  static async unsubscribe(email) {
    const normalized = email.toLowerCase().trim();
    if (checkDbConnection()) {
      const sub = await Newsletter.findOne({ email: normalized });
      if (sub) {
        sub.isActive = false;
        await sub.save();
      }
      return { message: 'Unsubscribed successfully.' };
    } else {
      const sub = memoryStore.newsletters.find(n => n.email === normalized);
      if (sub) sub.isActive = false;
      return { message: 'Unsubscribed successfully.' };
    }
  }

  static async getAllSubscribers({ page = 1, limit = 50 }) {
    if (checkDbConnection()) {
      const skip = (page - 1) * limit;
      const total = await Newsletter.countDocuments();
      const subscribers = await Newsletter.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
      return { subscribers, total, page: Number(page), pages: Math.ceil(total / limit) };
    } else {
      const total = memoryStore.newsletters.length;
      const skip = (page - 1) * limit;
      const subscribers = memoryStore.newsletters.slice(skip, skip + Number(limit));
      return { subscribers, total, page: Number(page), pages: Math.ceil(total / limit) };
    }
  }
}
