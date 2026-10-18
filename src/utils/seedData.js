export const seedProducts = [
  {
    name: "AgrivaFoods Moringa Powder",
    slug: "organic-moringa-powder",
    tagline: "All The Goodness, Naturally.",
    category: "Superfood Powders",
    description: "Experience the remarkable benefits of AgrivaFoods Organic Moringa Powder, sourced from carefully shade-dried, pure Moringa oleifera leaves. Revered as the 'Miracle Tree', Moringa is loaded with essential plant protein, natural iron, calcium, and vital bio-active vitamins that revitalize daily stamina, enhance immune defense, and foster healthy hair and radiant skin.",
    shortDescription: "100% Pure Organic Moringa Leaf Powder. Glows Skin & Hair, Boosts Immunity, and Rich In Nutrients.",
    rating: 4.9,
    reviewCount: 124,
    badge: "Bestseller",
    featured: true,
    currency: "INR",
    origin: "India",
    shelfLife: "12 Months",
    storageInstructions: "Store in a cool, dry place away from direct sunlight. Ensure zip-lock pouch is tightly sealed after every use.",
    usageInstructions: "Mix 1/2 to 1 teaspoon (2g - 5g) of AgrivaFoods Moringa Powder into warm water with a dash of lemon or honey. You can also easily blend it into morning smoothies, fresh green juices, curd, or sprinkle over fresh salads.",
    ingredients: [
      "100% Pure Organic Moringa (Moringa oleifera) Leaf Powder",
      "No preservatives, No added sugar, No artificial fillers"
    ],
    benefits: [
      "Glows Skin & Hair: Packed with natural antioxidants, Vitamin E, and bio-actives",
      "Boosts Immunity: Fortifies cellular defenses with Vitamin C and iron",
      "Rich In Nutrients: Contains 90+ nutrients, 46 antioxidants, and essential plant amino acids",
      "Fights daily fatigue and supports long-lasting natural energy without crashes",
      "Supports healthy digestion and whole-body metabolic equilibrium"
    ],
    nutrition: {
      Energy: "320 kcal",
      Protein: "27.1 g",
      Carbohydrates: "38.2 g",
      DietaryFiber: "19.2 g",
      Fat: "2.3 g",
      Calcium: "2003 mg",
      Iron: "28.2 mg",
      VitaminA: "16.3 mg",
      VitaminC: "120 mg"
    },
    images: [
      "/assets/moringa-packaging.png",
      "/assets/moringa-bowl.png"
    ],
    variants: [
      {
        sku: "AGR-MOR-100",
        weight: "100g",
        price: 149,
        originalPrice: 199,
        stock: 65,
        isPopular: false
      },
      {
        sku: "AGR-MOR-250",
        weight: "250g",
        price: 299,
        originalPrice: 349,
        stock: 100,
        isPopular: true
      },
      {
        sku: "AGR-MOR-500",
        weight: "500g",
        price: 549,
        originalPrice: 649,
        stock: 45,
        isPopular: false
      },
      {
        sku: "AGR-MOR-1000",
        weight: "1kg",
        price: 999,
        originalPrice: 1199,
        stock: 25,
        isPopular: false
      }
    ]
  },
  {
    name: "AgrivaFoods Beetroot Powder",
    slug: "beetroot-powder",
    tagline: "Athletic Stamina & Cardiovascular Wellness",
    category: "Superfood Powders",
    description: "AgrivaFoods Beetroot Powder is a rich, natural source of dietary nitrates, vital trace minerals, and pure betalain antioxidants. Crafted from premium dehydrated red beets, this vibrant scarlet powder naturally supports healthy nitric oxide production, enhancing athletic stamina, physical endurance, and optimal cardiovascular flow. With an earthy, mildly sweet profile, it is an ideal clean pre-workout addition.",
    shortDescription: "Pure dehydrated red beetroot powder packed with natural nitrates to power circulation and natural stamina.",
    rating: 4.8,
    reviewCount: 88,
    badge: "Pre-Workout Favorite",
    featured: true,
    currency: "INR",
    origin: "India",
    shelfLife: "12 Months",
    storageInstructions: "Store in an airtight container in a cool, dry pantry. Natural moisture may cause slight clumping, which does not impact potency.",
    usageInstructions: "Mix 1 teaspoon (5g) in 250ml water, fresh juice, or a pre-workout drink 30 minutes before workout or brisk exercise. Also delicious blended into oatmeal, baking recipes, and savory dishes for natural color and nutrients.",
    ingredients: [
      "100% Pure Dehydrated Red Beetroot (Beta vulgaris) Powder",
      "Zero artificial colors, Zero added sugar"
    ],
    benefits: [
      "Naturally high in dietary nitrates to support healthy blood flow & endurance",
      "Excellent natural pre-workout booster without caffeine jitters",
      "Promotes cardiovascular wellness and balanced arterial circulation",
      "Contains powerful Betalain antioxidants for cellular recovery",
      "Provides natural, clean plant energy for daily physical performance"
    ],
    nutrition: {
      Energy: "350 kcal",
      Protein: "11.3 g",
      Carbohydrates: "70.1 g",
      DietaryFiber: "6.2 g",
      Fat: "0.5 g",
      Potassium: "1530 mg",
      Iron: "6.1 mg",
      Sodium: "260 mg"
    },
    images: [
      "/assets/beetroot-packaging.png"
    ],
    variants: [
      {
        sku: "AGR-BEE-100",
        weight: "100g",
        price: 129,
        originalPrice: 169,
        stock: 50,
        isPopular: false
      },
      {
        sku: "AGR-BEE-250",
        weight: "250g",
        price: 249,
        originalPrice: 299,
        stock: 80,
        isPopular: true
      },
      {
        sku: "AGR-BEE-500",
        weight: "500g",
        price: 449,
        originalPrice: 529,
        stock: 35,
        isPopular: false
      },
      {
        sku: "AGR-BEE-1000",
        weight: "1kg",
        price: 799,
        originalPrice: 949,
        stock: 20,
        isPopular: false
      }
    ]
  },
  {
    name: "AgrivaFoods Amla Powder",
    slug: "amla-powder",
    tagline: "Natural Vitamin C & Hair Vitality Elixir",
    category: "Superfood Powders",
    description: "AgrivaFoods Amla (Indian Gooseberry) Powder is traditionally recognized as nature's highest concentrated botanical source of Vitamin C. Hand-harvested and sun-dried to lock in delicate antioxidants, it provides targeted immune defense, aids digestive enzymes, and nourishes hair follicles from within for lustrous growth and clear, revitalized skin.",
    shortDescription: "Authentic sun-dried Indian Gooseberry powder providing potent raw Vitamin C, collagen support, and hair strength.",
    rating: 4.9,
    reviewCount: 104,
    badge: "High Vitamin C",
    featured: true,
    currency: "INR",
    origin: "India",
    shelfLife: "12 Months",
    storageInstructions: "Keep tightly sealed in a dry environment away from dampness and direct sunlight. Keep seal air-tight.",
    usageInstructions: "Mix 1/2 teaspoon (2.5g) of Amla powder with lukewarm water every morning on an empty stomach. Add a spoonful of pure raw honey to soften the natural tangy astringency. Can also be applied as an herbal hair or facial mask.",
    ingredients: [
      "100% Pure Sun-Dried Amla (Phyllanthus emblica) Fruit Powder",
      "Raw, Unadulterated, Chemical-Free"
    ],
    benefits: [
      "One of nature's richest whole-food sources of natural Vitamin C",
      "Strengthens hair roots, curbs excessive hair fall, and restores shine",
      "Significantly boosts biological iron absorption from everyday meals",
      "Helps regulate stomach acid and supports comfortable gut digestion",
      "Promotes collagen synthesis for firm, youthful skin elasticity"
    ],
    nutrition: {
      Energy: "298 kcal",
      Protein: "1.2 g",
      Carbohydrates: "68.9 g",
      DietaryFiber: "22.5 g",
      Fat: "0.4 g",
      VitaminC: "600 mg",
      Calcium: "50 mg",
      Iron: "1.2 mg"
    },
    images: [
      "/assets/amla-packaging.png"
    ],
    variants: [
      {
        sku: "AGR-AML-100",
        weight: "100g",
        price: 99,
        originalPrice: 139,
        stock: 75,
        isPopular: false
      },
      {
        sku: "AGR-AML-250",
        weight: "250g",
        price: 199,
        originalPrice: 249,
        stock: 85,
        isPopular: true
      },
      {
        sku: "AGR-AML-500",
        weight: "500g",
        price: 349,
        originalPrice: 429,
        stock: 40,
        isPopular: false
      },
      {
        sku: "AGR-AML-1000",
        weight: "1kg",
        price: 629,
        originalPrice: 749,
        stock: 20,
        isPopular: false
      }
    ]
  }
];

export const seedFAQs = [
  {
    category: "Products & Usage",
    question: "What products does AgrivaFoods offer?",
    answer: "AgrivaFoods specializes in premium, 100% natural and pure superfood powders. Currently, our range includes Organic Moringa Powder (rich in iron & plant nutrients), Beetroot Powder (natural nitrates for athletic stamina), and Sun-Dried Amla Powder (nature's richest botanical Vitamin C source).",
    order: 1
  },
  {
    category: "Products & Usage",
    question: "What is Moringa Powder and how does it help?",
    answer: "Moringa Powder is derived from the dried leaves of the Moringa oleifera tree, often called the 'Miracle Tree'. It contains 90+ bioactive nutrients, essential plant proteins, high natural iron, and calcium that aid in fighting daily fatigue, boosting immunity, and sustaining long-lasting vitality.",
    order: 2
  },
  {
    category: "Products & Usage",
    question: "How should I consume these superfood powders?",
    answer: "Most of our powders can be mixed into lukewarm water, herbal tea, green juices, breakfast smoothies, yogurt, or stirred into oatmeal. Detailed daily serving suggestions are provided on each product packaging and its product details page.",
    order: 3
  },
  {
    category: "Products & Usage",
    question: "What is the shelf life and proper storage instruction?",
    answer: "Our powders have a shelf life of 12 months from the packaging date. To retain raw botanical potency, keep the pouch in a cool, dry place away from direct sunlight, and always press the ziplock seal shut immediately after use.",
    order: 4
  },
  {
    category: "Products & Usage",
    question: "Are there any artificial fillers, chemicals, or preservatives?",
    answer: "Never. All AgrivaFoods products contain single-ingredient botanicals with zero synthetic chemicals, no artificial food colors, no refined sugars, and no preservatives.",
    order: 5
  },
  {
    category: "Ordering & Shipping",
    question: "How do I place an order on AgrivaFoods?",
    answer: "Browse our products, select your desired package size (100g, 250g, 500g, or 1kg), click 'Add to Cart', and proceed to checkout. You can complete your order using secure UPI, Credit/Debit Cards, Net Banking, or Cash on Delivery (COD).",
    order: 6
  },
  {
    category: "Ordering & Shipping",
    question: "What payment options are available?",
    answer: "We support Instant UPI (Google Pay, PhonePe, Paytm), Credit & Debit Cards (Visa, MasterCard, RuPay), Net Banking across all major banks, and Cash on Delivery (COD).",
    order: 7
  },
  {
    category: "Ordering & Shipping",
    question: "What are your delivery charges and timeline?",
    answer: "We provide Free Standard Shipping on all orders over ₹499 across India. For orders below ₹499, a nominal ₹49 flat courier fee is applied. Deliveries typically arrive within 3 to 5 business days.",
    order: 8
  },
  {
    category: "Ordering & Shipping",
    question: "Can I return my order if I am unsatisfied?",
    answer: "We stand with pride behind our natural quality. If you receive a damaged package or have any quality concern, please notify our team within 7 days of delivery for a hassle-free replacement or full refund.",
    order: 9
  },
  {
    category: "Ordering & Shipping",
    question: "How can I contact AgrivaFoods customer support?",
    answer: "You can reach us directly via Phone Call at +91 88300 52087, via WhatsApp message at +91 88300 52087, or by writing to agrivafoods03@gmail.com. Our team is available Monday to Saturday, 9:00 AM to 7:00 PM IST.",
    order: 10
  }
];

export const seedReviews = [
  {
    name: "Dr. Aarti Sharma",
    location: "Mumbai, Maharashtra",
    productName: "AgrivaFoods Moringa Powder",
    rating: 5,
    title: "Remarkable Purity & Lasting Daily Energy",
    comment: "Excellent quality Moringa powder! The deep emerald green color and fresh grassy aroma immediately show its purity. I feel notably more energetic throughout the workday since I started mixing this in my morning lukewarm water with lemon.",
    verified: true,
    helpfulCount: 24,
    status: "approved"
  },
  {
    name: "Vikram Singhania",
    location: "Bengaluru, Karnataka",
    productName: "AgrivaFoods Beetroot Powder",
    rating: 5,
    title: "Best Clean Pre-Workout Alternative",
    comment: "I replaced caffeine stimulants with AgrivaFoods Beetroot powder before my gym sessions. The natural pumps and endurance boost are noticeable without the crash or jitters. Pure and earthy taste.",
    verified: true,
    helpfulCount: 19,
    status: "approved"
  },
  {
    name: "Pooja Deshmukh",
    location: "Pune, Maharashtra",
    productName: "AgrivaFoods Amla Powder",
    rating: 5,
    title: "Visible Difference in Hair Vitality",
    comment: "Hands down the freshest Amla powder I have bought online. It has the authentic tangy astringency that genuine Indian Gooseberry should have. My hair fall has visibly reduced in a month.",
    verified: true,
    helpfulCount: 31,
    status: "approved"
  }
];

export const seedCoupons = [
  {
    code: "WELCOME10",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 299,
    maxDiscount: 100,
    isActive: true,
    description: "10% off on your first superfood order"
  },
  {
    code: "AGRIVA50",
    discountType: "fixed",
    discountValue: 50,
    minOrderAmount: 499,
    isActive: true,
    description: "Flat ₹50 off on orders above ₹499"
  },
  {
    code: "FREESHIP",
    discountType: "fixed",
    discountValue: 49,
    minOrderAmount: 299,
    isActive: true,
    description: "Free shipping voucher"
  }
];
