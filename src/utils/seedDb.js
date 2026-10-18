import mongoose from 'mongoose';
import dns from 'dns';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Homepage } from '../models/Homepage.js';
import { Review } from '../models/Review.js';
import { Coupon } from '../models/Coupon.js';
import { FAQ } from '../models/FAQ.js';
import { seedProducts, seedFAQs, seedReviews, seedCoupons } from './seedData.js';
import { env } from '../config/env.js';

// Configure resilient DNS resolution for Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

export const seedDatabase = async () => {
  try {
    console.log('====================================================');
    console.log(' AgrivaFoods Database Initialization & Seeder');
    console.log('====================================================\n');

    let conn;
    if (mongoose.connection.readyState !== 1) {
      console.log('Connecting to database...');
      conn = await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
      });
    } else {
      conn = mongoose.connection;
    }

    const host = conn.connection?.host || mongoose.connection.host;
    const dbName = conn.connection?.name || mongoose.connection.name;

    console.log(`Connected successfully!`);
    console.log(` Target Host:     ${host}`);
    console.log(` Target Database: "${dbName}"\n`);

    const isAtlas = host.includes('mongodb.net');
    console.log(` Environment:     ${isAtlas ? 'MongoDB Atlas Cloud' : 'Local MongoDB'}\n`);

    // 1. Seed Admin User
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123';
    let admin = await User.findOne({ email: 'admin@agrivafoods.com' });
    if (!admin) {
      admin = await User.create({
        name: 'AgrivaFoods Administrator',
        email: 'admin@agrivafoods.com',
        password: adminPassword,
        role: 'admin',
        phone: '+91 88300 52087',
        isActive: true
      });
      console.log(' [OK] Created initial admin user (email: admin@agrivafoods.com)');
    } else {
      console.log(' [OK] Admin user already exists (preserved)');
    }

    // 2. Seed Customer User
    let customer = await User.findOne({ email: 'customer@agrivafoods.com' });
    if (!customer) {
      await User.create({
        name: 'Demo Customer',
        email: 'customer@agrivafoods.com',
        password: 'Customer@123',
        role: 'customer',
        phone: '+91 98765 43210',
        isActive: true,
        addresses: [
          {
            fullName: 'Demo Customer',
            address: 'Flat 402, Green Meadows',
            apartment: 'Sector 5',
            city: 'Mumbai',
            state: 'Maharashtra',
            pinCode: '400001',
            phone: '+91 98765 43210',
            isDefault: true
          }
        ]
      });
      console.log(' [OK] Created demo customer account');
    } else {
      console.log(' [OK] Demo customer already exists (preserved)');
    }

    // 3. Seed Categories
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      await Category.create([
        {
          name: 'Superfood Powders',
          slug: 'superfood-powders',
          description: 'Single-ingredient, nutrient-dense organic botanical powders',
          image: '/assets/moringa-packaging.png',
          order: 1
        },
        {
          name: 'Single-Ingredient Powders',
          slug: 'single-ingredient-powders',
          description: '100% Pure, shade-dried whole herb leaf & fruit powders',
          image: '/assets/beetroot-packaging.png',
          order: 2
        },
        {
          name: 'Wellness Essentials',
          slug: 'wellness-essentials',
          description: 'Everyday vitality, athletic endurance and immune defense',
          image: '/assets/amla-packaging.png',
          order: 3
        }
      ]);
      console.log(' [OK] Created 3 product categories');
    } else {
      console.log(` [OK] Categories already exist (${categoryCount} found, preserved)`);
    }

    // 4. Seed Homepage Config
    const homepageExists = await Homepage.findOne();
    if (!homepageExists) {
      await Homepage.create({
        heroTitle: 'SUPERFOOD. NATURALLY BETTER.',
        heroSubtitle: '100% Raw, Pure Single-Ingredient Powders For Daily Vitality',
        heroBadge: '100% PURE & BOTANICAL',
        heroCtaText: 'Shop Pure Powders',
        heroCtaLink: '/products',
        featuredProductSlug: 'organic-moringa-powder',
        heroImage: '/assets/moringa-packaging.png',
        announcementText: 'FREE Express Delivery on all orders above ₹499 • 100% Pure & Lab Tested',
        showFeaturedSection: true,
        showTrustBadges: true,
        showWhyChoose: true,
        showReviews: true,
        showFaq: true
      });
      console.log(' [OK] Created homepage CMS layout and trust badge configuration');
    } else {
      console.log(' [OK] Homepage CMS config already exists (preserved)');
    }

    // 5. Seed Products
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      for (const p of seedProducts) {
        await Product.create({
          ...p,
          status: 'published',
          isActive: true,
          inStock: true
        });
      }
      console.log(` [OK] Created ${seedProducts.length} published products with variants`);
    } else {
      console.log(` [OK] Products already exist (${productCount} found, preserved)`);
    }

    // 6. Seed Reviews
    const reviewCount = await Review.countDocuments();
    if (reviewCount === 0) {
      for (const r of seedReviews) {
        await Review.create({ ...r, status: 'approved' });
      }
      console.log(` [OK] Created ${seedReviews.length} product reviews`);
    } else {
      console.log(` [OK] Reviews already exist (${reviewCount} found, preserved)`);
    }

    // 7. Seed FAQs
    const faqCount = await FAQ.countDocuments();
    if (faqCount === 0) {
      for (const f of seedFAQs) {
        await FAQ.create(f);
      }
      console.log(` [OK] Created ${seedFAQs.length} store FAQs`);
    } else {
      console.log(` [OK] FAQs already exist (${faqCount} found, preserved)`);
    }

    // 8. Seed Coupons
    const couponCount = await Coupon.countDocuments();
    if (couponCount === 0) {
      for (const c of seedCoupons) {
        await Coupon.create(c);
      }
      console.log(` [OK] Created ${seedCoupons.length} promotional coupon`);
    } else {
      console.log(` [OK] Coupons already exist (${couponCount} found, preserved)`);
    }

    console.log('\n====================================================');
    console.log(' Database initialization completed successfully!');
    console.log(' Zero orders created (orders collection is clean).');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n [ERROR] Failed to seed database:', error.message);
    process.exitCode = 1;
  }
};

// If run directly from CLI
if (process.argv[1]?.endsWith('seedDb.js')) {
  seedDatabase().then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
