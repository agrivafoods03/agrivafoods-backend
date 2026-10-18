import mongoose from 'mongoose';

const homepageSchema = new mongoose.Schema(
  {
    heroTitle: {
      type: String,
      default: 'SUPERFOOD. NATURALLY BETTER.'
    },
    heroSubtitle: {
      type: String,
      default: '100% Raw, Pure Single-Ingredient Powders For Daily Vitality'
    },
    heroBadge: {
      type: String,
      default: '100% PURE & BOTANICAL'
    },
    heroCtaText: {
      type: String,
      default: 'Shop Pure Powders'
    },
    heroCtaLink: {
      type: String,
      default: '/products'
    },
    featuredProductSlug: {
      type: String,
      default: ''
    },
    heroImage: {
      type: String,
      default: '/assets/moringa-packaging.png'
    },
    announcementText: {
      type: String,
      default: 'FREE Express Delivery on all orders above ₹499 • 100% Pure & Lab Tested'
    },
    showFeaturedSection: {
      type: Boolean,
      default: true
    },
    showTrustBadges: {
      type: Boolean,
      default: true
    },
    showWhyChoose: {
      type: Boolean,
      default: true
    },
    showReviews: {
      type: Boolean,
      default: true
    },
    showFaq: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export const Homepage = mongoose.model('Homepage', homepageSchema);
