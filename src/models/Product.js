import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true },
    weight: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, default: 50, min: 0 },
    isPopular: { type: Boolean, default: false },
    inStock: { type: Boolean, default: true },
    image: { type: String, default: null }
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide product name'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters']
    },
    slug: {
      type: String,
      required: [true, 'Please provide product slug'],
      unique: true,
      lowercase: true,
      trim: true
    },
    sku: { type: String, trim: true },
    tagline: { type: String, trim: true },
    category: {
      type: String,
      required: true,
      trim: true,
      default: 'Superfood Powders'
    },
    description: { type: String, required: true },
    shortDescription: { type: String, trim: true },
    rating: { type: Number, default: 5.0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    badge: { type: String, trim: true },
    featured: { type: Boolean, default: false },
    currency: { type: String, default: 'INR' },
    origin: { type: String, default: 'India' },
    shelfLife: { type: String, default: '12 Months' },
    storageInstructions: { type: String },
    usageInstructions: { type: String },
    ingredients: [{ type: String }],
    benefits: [{ type: String }],
    nutrition: {
      type: Map,
      of: String
    },
    images: [{ type: String }],
    variants: [variantSchema],
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['published', 'draft', 'archived'],
      default: 'published'
    },
    inStock: { type: Boolean, default: true },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true }
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', category: 'text' });

export const Product = mongoose.model('Product', productSchema);
