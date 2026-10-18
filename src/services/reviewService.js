import { Review } from '../models/Review.js';
import { Product } from '../models/Product.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';

export class ReviewService {
  static async getReviews({ productName, status = 'approved', page = 1, limit = 50, rating }) {
    if (checkDbConnection()) {
      const query = {};
      if (status && status !== 'all') query.status = status;
      if (productName && productName !== 'All') query.productName = { $regex: productName, $options: 'i' };
      if (rating && rating !== 'all') query.rating = Number(rating);

      const skip = (page - 1) * limit;
      const total = await Review.countDocuments(query);
      const reviews = await Review.find(query).sort({ helpfulCount: -1, createdAt: -1 }).skip(skip).limit(Number(limit));

      return { reviews, total, page: Number(page), pages: Math.ceil(total / limit) };
    } else {
      let list = [...memoryStore.reviews];
      if (status && status !== 'all') {
        list = list.filter(r => (r.status || 'approved') === status);
      }
      if (productName && productName !== 'All') {
        const p = productName.toLowerCase();
        list = list.filter(r => (r.productName || '').toLowerCase().includes(p));
      }
      if (rating && rating !== 'all') {
        list = list.filter(r => r.rating === Number(rating));
      }
      list.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0));

      const total = list.length;
      const skip = (page - 1) * limit;
      const paginated = list.slice(skip, skip + Number(limit));

      return { reviews: paginated, total, page: Number(page), pages: Math.ceil(total / limit) };
    }
  }

  static async recalculateProductRating(productName) {
    if (!productName) return;

    if (checkDbConnection()) {
      const approvedReviews = await Review.find({ productName: { $regex: new RegExp(`^${productName}$`, 'i') }, status: 'approved' });
      const count = approvedReviews.length;
      const avg = count > 0 ? (approvedReviews.reduce((sum, r) => sum + r.rating, 0) / count) : 5.0;
      const roundedAvg = Math.round(avg * 10) / 10;

      await Product.updateMany(
        { name: { $regex: new RegExp(productName, 'i') } },
        { rating: roundedAvg, reviewCount: count }
      );
    } else {
      const approved = memoryStore.reviews.filter(
        r => r.productName?.toLowerCase().includes(productName.toLowerCase()) && (r.status === 'approved' || !r.status)
      );
      const count = approved.length;
      const avg = count > 0 ? (approved.reduce((sum, r) => sum + r.rating, 0) / count) : 5.0;
      const roundedAvg = Math.round(avg * 10) / 10;

      for (const p of memoryStore.products) {
        if (p.name.toLowerCase().includes(productName.toLowerCase())) {
          p.rating = roundedAvg;
          p.reviewCount = count;
        }
      }
    }
  }

  static async createReview(reviewData, userId = null) {
    const { name, rating, title, comment, productName, location } = reviewData;
    if (!name || !rating || !comment || !productName) {
      throw new ApiError(400, 'Name, rating, productName, and comment are required.');
    }

    const payload = {
      user: userId || null,
      name,
      rating: Number(rating),
      title: title || '',
      comment,
      productName,
      location: location || 'India',
      verified: true,
      helpfulCount: 0,
      status: 'approved' // Automatically approve initial reviews or moderate
    };

    let newReview;
    if (checkDbConnection()) {
      newReview = await Review.create(payload);
    } else {
      newReview = {
        _id: `rev_${Date.now()}`,
        id: `rev_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString()
      };
      memoryStore.reviews.unshift(newReview);
    }

    await this.recalculateProductRating(productName);
    return newReview;
  }

  static async upvoteReview(reviewId) {
    if (checkDbConnection()) {
      const review = await Review.findByIdAndUpdate(reviewId, { $inc: { helpfulCount: 1 } }, { new: true });
      if (!review) throw new ApiError(404, 'Review not found.');
      return review;
    } else {
      const review = memoryStore.reviews.find(r => r._id === reviewId || r.id === reviewId);
      if (!review) throw new ApiError(404, 'Review not found.');
      review.helpfulCount = (review.helpfulCount || 0) + 1;
      return review;
    }
  }

  static async updateReviewStatus(reviewId, status) {
    let review;
    if (checkDbConnection()) {
      review = await Review.findByIdAndUpdate(reviewId, { status }, { new: true });
      if (!review) throw new ApiError(404, 'Review not found.');
    } else {
      review = memoryStore.reviews.find(r => r._id === reviewId || r.id === reviewId);
      if (!review) throw new ApiError(404, 'Review not found.');
      review.status = status;
    }

    if (review?.productName) {
      await this.recalculateProductRating(review.productName);
    }
    return review;
  }

  static async deleteReview(reviewId) {
    let productName = null;
    if (checkDbConnection()) {
      const review = await Review.findById(reviewId);
      if (!review) throw new ApiError(404, 'Review not found.');
      productName = review.productName;
      await Review.findByIdAndDelete(reviewId);
    } else {
      const idx = memoryStore.reviews.findIndex(r => r._id === reviewId || r.id === reviewId);
      if (idx === -1) throw new ApiError(404, 'Review not found.');
      productName = memoryStore.reviews[idx].productName;
      memoryStore.reviews.splice(idx, 1);
    }

    if (productName) {
      await this.recalculateProductRating(productName);
    }
    return { success: true, message: 'Review deleted successfully' };
  }
}
