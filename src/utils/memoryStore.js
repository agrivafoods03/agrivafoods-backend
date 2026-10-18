import bcrypt from 'bcryptjs';
import { seedProducts, seedFAQs, seedReviews, seedCoupons } from './seedData.js';

// Deep clone helper
const clone = (data) => JSON.parse(JSON.stringify(data));

class MemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.products = seedProducts.map((p, index) => ({
      _id: `prod_seed_${index + 1}`,
      id: `prod_seed_${index + 1}`,
      ...clone(p),
      isActive: true,
      status: 'published',
      inStock: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    this.categories = [
      {
        _id: 'cat_1',
        name: 'Superfood Powders',
        slug: 'superfood-powders',
        description: 'Single-ingredient, nutrient-dense organic botanical powders',
        image: '/assets/moringa-packaging.png',
        isActive: true,
        order: 1
      },
      {
        _id: 'cat_2',
        name: 'Single-Ingredient Powders',
        slug: 'single-ingredient-powders',
        description: '100% Pure, shade-dried whole herb leaf & fruit powders',
        image: '/assets/beetroot-packaging.png',
        isActive: true,
        order: 2
      },
      {
        _id: 'cat_3',
        name: 'Wellness Essentials',
        slug: 'wellness-essentials',
        description: 'Everyday vitality, athletic endurance and immune defense',
        image: '/assets/amla-packaging.png',
        isActive: true,
        order: 3
      }
    ];

    this.homepage = {
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
      showFaq: true,
      updatedAt: new Date().toISOString()
    };

    this.media = [
      {
        _id: 'media_1',
        filename: 'moringa-packaging.png',
        url: '/assets/moringa-packaging.png',
        size: 39663,
        mimeType: 'image/png',
        altText: 'AgrivaFoods Organic Moringa Powder Packaging',
        createdAt: new Date().toISOString()
      },
      {
        _id: 'media_2',
        filename: 'beetroot-packaging.png',
        url: '/assets/beetroot-packaging.png',
        size: 669921,
        mimeType: 'image/png',
        altText: 'AgrivaFoods Pure Beetroot Powder Packaging',
        createdAt: new Date().toISOString()
      },
      {
        _id: 'media_3',
        filename: 'amla-packaging.png',
        url: '/assets/amla-packaging.png',
        size: 663978,
        mimeType: 'image/png',
        altText: 'AgrivaFoods Sun-Dried Amla Powder Packaging',
        createdAt: new Date().toISOString()
      }
    ];

    this.faqs = seedFAQs.map((f, index) => ({
      _id: `faq_seed_${index + 1}`,
      ...clone(f),
      isActive: true,
      createdAt: new Date().toISOString()
    }));

    this.reviews = seedReviews.map((r, index) => ({
      _id: `rev_seed_${index + 1}`,
      ...clone(r),
      status: 'approved',
      createdAt: new Date().toISOString()
    }));

    this.coupons = seedCoupons.map((c, index) => ({
      _id: `coup_seed_${index + 1}`,
      ...clone(c),
      usedCount: 0,
      createdAt: new Date().toISOString()
    }));

    // Pre-populate default admin and demo user
    const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
    const userPasswordHash = bcrypt.hashSync('Customer@123', 10);

    this.users = [
      {
        _id: 'user_admin_1',
        id: 'user_admin_1',
        name: 'AgrivaFoods Administrator',
        email: 'admin@agrivafoods.com',
        password: adminPasswordHash,
        role: 'admin',
        phone: '+91 88300 52087',
        addresses: [],
        wishlist: [],
        isActive: true,
        createdAt: new Date().toISOString()
      },
      {
        _id: 'user_demo_1',
        id: 'user_demo_1',
        name: 'Demo Customer',
        email: 'customer@agrivafoods.com',
        password: userPasswordHash,
        role: 'customer',
        phone: '+91 98765 43210',
        addresses: [
          {
            _id: 'addr_1',
            street: 'Flat 402, Green Meadows',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            isDefault: true
          }
        ],
        wishlist: [],
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    this.orders = [
      {
        _id: 'ord_seed_1',
        orderNumber: 'AGR-2026-00101',
        customer: {
          name: 'Pooja Deshmukh',
          email: 'pooja.deshmukh@example.com',
          phone: '+91 98220 12345'
        },
        shippingAddress: {
          street: 'Apt 12, Sunrise Residency, Baner Road',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411045'
        },
        items: [
          {
            productSlug: 'organic-moringa-powder',
            productName: 'AgrivaFoods Moringa Powder',
            weight: '250g',
            price: 299,
            quantity: 2,
            itemTotal: 598
          }
        ],
        subtotal: 598,
        shippingFee: 0,
        discount: 0,
        total: 598,
        paymentMethod: 'UPI',
        paymentStatus: 'paid',
        orderStatus: 'delivered',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    this.contacts = [
      {
        _id: 'cont_seed_1',
        name: 'Rajesh Kulkarni',
        email: 'rajesh.k@example.com',
        phone: '+91 98450 11223',
        subject: 'Wholesale B2B Bulk Inquiry',
        message: 'Looking for 50kg bulk supply of organic Moringa and Amla powder for our retail wellness store.',
        status: 'new',
        createdAt: new Date().toISOString()
      }
    ];

    this.newsletters = [
      {
        _id: 'news_seed_1',
        email: 'newsletter.subscriber@example.com',
        isActive: true,
        subscribedAt: new Date().toISOString()
      }
    ];
  }
}

export const memoryStore = new MemoryStore();
