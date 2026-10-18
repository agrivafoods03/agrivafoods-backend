# AgrivaFoods - Backend REST API

Welcome to the backend service for **AgrivaFoods** (All The Goodness, Naturally), an e-commerce platform dedicated to 100% natural, single-ingredient superfood powders (Organic Moringa Powder, Beetroot Powder, and Sun-Dried Amla Powder).

This backend is built with **Node.js**, **Express.js**, and **MongoDB / Mongoose**, providing a modular architecture, clean RESTful endpoints, JWT authentication, role-based access control, and resilient database fallback.

---

## 📁 Project Architecture & Folder Structure

```
project/
├── frontend/                     # Existing React/Vite/Tailwind frontend application
└── backend/                      # Independent Express & MongoDB backend application
    ├── src/
    │   ├── config/               # Configuration settings & DB lifecycle
    │   │   ├── db.js             # Mongoose connection with non-blocking graceful fallback
    │   │   └── env.js            # Validated environment configuration
    │   │
    │   ├── controllers/          # HTTP request handlers
    │   │   ├── authController.js       # Register, login, profile, password change
    │   │   ├── userController.js       # User management, address book, wishlist
    │   │   ├── productController.js    # Catalog, products by slug, categories
    │   │   ├── orderController.js      # Cart checkout, order tracking, statuses
    │   │   ├── reviewController.js     # Reviews list, submission, upvoting
    │   │   ├── contactController.js    # Contact us & B2B inquiry submissions
    │   │   ├── newsletterController.js # Email newsletter subscriptions
    │   │   ├── faqController.js        # Frequently asked questions
    │   │   ├── couponController.js     # Promotional vouchers and checkout discounts
    │   │   └── dashboardController.js  # Administrative statistics & metrics
    │   │
    │   ├── middlewares/          # Request interceptors & security
    │   │   ├── authMiddleware.js       # JWT authentication & role-based authorization
    │   │   ├── errorMiddleware.js      # Centralized error handler & 404 handler
    │   │   ├── rateLimiter.js          # DDoS and brute-force protection
    │   │   └── validateMiddleware.js   # Request body & payload validator
    │   │
    │   ├── models/               # Mongoose database schemas & models
    │   │   ├── User.js           # Customers & administrators with bcrypt hashing
    │   │   ├── Product.js        # Superfood products with variants, nutrition & benefits
    │   │   ├── Order.js          # Orders, items, pricing rules, statuses, timeline
    │   │   ├── Review.js         # Verified customer reviews & helpful votes
    │   │   ├── Contact.js        # Contact & wholesale inquiries
    │   │   ├── Newsletter.js     # Email subscribers
    │   │   ├── FAQ.js            # Categorized FAQs
    │   │   └── Coupon.js         # Discounts and promo codes
    │   │
    │   ├── routes/               # Clean RESTful API route definitions
    │   │   ├── authRoutes.js
    │   │   ├── userRoutes.js
    │   │   ├── productRoutes.js
    │   │   ├── orderRoutes.js
    │   │   ├── reviewRoutes.js
    │   │   ├── contactRoutes.js
    │   │   ├── newsletterRoutes.js
    │   │   ├── faqRoutes.js
    │   │   ├── couponRoutes.js
    │   │   ├── dashboardRoutes.js
    │   │   └── index.js          # Aggregated router mounted at /api
    │   │
    │   ├── services/             # Core business logic layer
    │   │   ├── authService.js
    │   │   ├── userService.js
    │   │   ├── productService.js
    │   │   ├── orderService.js
    │   │   ├── reviewService.js
    │   │   ├── contactService.js
    │   │   ├── newsletterService.js
    │   │   ├── faqService.js
    │   │   ├── couponService.js
    │   │   └── dashboardService.js
    │   │
    │   ├── utils/                # Utilities and helpers
    │   │   ├── ApiError.js       # Operational error class
    │   │   ├── ApiResponse.js    # Standardized response wrapper
    │   │   ├── asyncHandler.js   # Async error-catching wrapper
    │   │   ├── logger.js         # Timestamped logging utility
    │   │   ├── memoryStore.js    # In-memory store when DB is disconnected
    │   │   └── seedData.js       # AgrivaFoods initial product, FAQ, and coupon data
    │   │
    │   ├── app.js                # Express app setup (CORS, Helmet, Morgan, JSON)
    │   └── server.js             # HTTP listener & connection bootstrapper
    │
    ├── tests/                    # Backend automated tests
    │   └── api.test.js           # Comprehensive integration test suite
    │
    ├── .env                      # Local environment configuration
    ├── .env.example              # Template for environment configuration
    ├── .gitignore                # Git ignore rules for node_modules, logs, .env
    ├── package.json              # Backend dependencies and scripts
    └── README.md                 # Documentation
```

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (ES Modules `type: module`)
- **Web Framework**: Express.js 4.x
- **Database**: MongoDB with Mongoose 8.x
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) + `bcryptjs`
- **Security**: `helmet`, `cors`, `express-rate-limit`
- **Logging**: `morgan` HTTP logger + custom timestamped logger
- **Testing**: Node.js Native Test Runner (`node:test`, `node:assert`)

---

## 🌐 Implemented API Endpoints

All endpoints are prefixed with `/api`.

### 1. System Health
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/health` | Service uptime, DB connection status, environment | Public |
| `GET` | `/` | API banner and root info | Public |

### 2. Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new customer account (`name`, `email`, `password`, `phone`) | Public (Rate-limited) |
| `POST` | `/api/auth/login` | Authenticate customer or admin (`email`, `password`) | Public (Rate-limited) |
| `GET` | `/api/auth/me` | Fetch currently logged-in user profile | Authenticated |
| `POST` | `/api/auth/change-password` | Update current password | Authenticated |
| `POST` | `/api/auth/logout` | Client-side session termination | Authenticated |

### 3. User Management (`/api/users`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/users/profile` | Get logged-in user's profile | Authenticated |
| `PUT` | `/api/users/profile` | Update profile information (`name`, `phone`) | Authenticated |
| `POST` | `/api/users/addresses` | Add a new delivery address | Authenticated |
| `DELETE` | `/api/users/addresses/:addressId` | Remove an address | Authenticated |
| `GET` | `/api/users/wishlist` | Retrieve user's wishlist | Authenticated |
| `POST` | `/api/users/wishlist/toggle` | Add/remove product from wishlist | Authenticated |
| `GET` | `/api/users` | List all users with pagination and search | Admin only |

### 4. Product Catalog (`/api/products`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/products` | Browse products (supports `search`, `category`, `sort`, `featured`, `page`, `limit`) | Public |
| `GET` | `/api/products/slug/:slug` | Get full product details by URL slug (e.g., `organic-moringa-powder`) | Public |
| `GET` | `/api/products/:id` | Get product details by ID | Public |
| `GET` | `/api/products/categories` | Get all distinct categories | Public |
| `POST` | `/api/products` | Create a new product | Admin only |
| `PUT` | `/api/products/:id` | Update an existing product | Admin only |
| `DELETE` | `/api/products/:id` | Archive a product (`isActive: false`) | Admin only |

### 5. Orders & Checkout (`/api/orders`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/orders` | Place order (guest or authenticated, calculates free shipping if subtotal >= ₹499) | Public / Auth |
| `GET` | `/api/orders/my-orders` | Get orders for the logged-in user | Authenticated |
| `GET` | `/api/orders/track/:orderNumber` | Track order by order number (e.g. `AGR-2026-00101`) | Public |
| `GET` | `/api/orders/:id` | Get order details by ID | Owner / Admin |
| `GET` | `/api/orders` | List all orders (filter by `status`, `search`, pagination) | Admin only |
| `PUT` | `/api/orders/:id/status` | Update `orderStatus`, `paymentStatus`, `trackingNumber` | Admin only |

### 6. Customer Reviews (`/api/reviews`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/reviews` | Get customer reviews (filter by `productName`, pagination) | Public |
| `POST` | `/api/reviews` | Submit a product review (`rating`, `title`, `comment`, `productName`, etc.) | Public / Auth |
| `POST` | `/api/reviews/:id/upvote`| Increment helpful vote count | Public |
| `PUT` | `/api/reviews/:id/status`| Moderate review (`approved`, `rejected`, `pending`) | Admin only |
| `DELETE` | `/api/reviews/:id` | Delete review | Admin only |

### 7. Coupons & Promotions (`/api/coupons`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/coupons/validate` | Check coupon validity (`code`, `subtotal`) and calculate discount | Public |
| `GET` | `/api/coupons` | List all coupon codes | Admin only |
| `POST` | `/api/coupons` | Create a new promotional voucher | Admin only |
| `DELETE` | `/api/coupons/:id` | Remove a coupon voucher | Admin only |

### 8. Contact & Wholesale Inquiries (`/api/contact`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/contact` | Submit contact / bulk inquiry form (`name`, `email`, `phone`, `subject`, `message`) | Public |
| `GET` | `/api/contact` | List all contact inquiries | Admin only |
| `PUT` | `/api/contact/:id/status`| Update status (`new`, `in_progress`, `resolved`) | Admin only |
| `DELETE` | `/api/contact/:id` | Delete inquiry | Admin only |

### 9. Newsletter (`/api/newsletter`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/newsletter/subscribe` | Subscribe email to wellness updates | Public |
| `POST` | `/api/newsletter/unsubscribe` | Unsubscribe email | Public |
| `GET` | `/api/newsletter` | View all active subscribers | Admin only |

### 10. Frequently Asked Questions (`/api/faqs`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/faqs` | Retrieve FAQs (optionally filter by `category`) | Public |
| `POST` | `/api/faqs` | Create new FAQ | Admin only |
| `PUT` | `/api/faqs/:id` | Update FAQ content or ordering | Admin only |
| `DELETE` | `/api/faqs/:id` | Delete FAQ entry | Admin only |

### 11. Admin Dashboard (`/api/dashboard`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/dashboard/stats` | Aggregated revenue, order status breakdown, customer count, recent orders | Admin only |

---

## 🔒 Standard API Response Structure

### Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "meta": {
    "total": 3,
    "page": 1,
    "pages": 1
  }
}
```

### Error Response (`400`, `401`, `403`, `404`, `409`, `500`)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Please provide a valid email address"
  ]
}
```

---

## 🗄️ Database Models & Relationships

1. **User (`User.js`)**:
   - Fields: `name`, `email` (unique), `password` (bcrypt hashed), `phone`, `role` (`customer`, `admin`), `addresses` (subdocument array), `wishlist` (array of product slugs/IDs), `isActive`.
   - Security: Pre-save hook hashes password; methods for `comparePassword` and `generateAuthToken`.

2. **Product (`Product.js`)**:
   - Fields: `name`, `slug` (unique index), `tagline`, `category`, `description`, `shortDescription`, `rating`, `reviewCount`, `badge`, `featured`, `currency`, `origin`, `shelfLife`, `storageInstructions`, `usageInstructions`, `ingredients`, `benefits`, `nutrition` (Map), `images`, `variants` (array of `{ sku, weight, price, originalPrice, stock, isPopular }`).
   - Indexes: Text index on `name`, `description`, `benefits` for high-performance search.

3. **Order (`Order.js`)**:
   - Fields: `orderNumber` (unique `AGR-YYYY-XXXXX`), `user` (ref to User or null for guest), `customer` (`name`, `email`, `phone`), `shippingAddress` (`street`, `city`, `state`, `pincode`), `items` (`productSlug`, `productName`, `weight`, `price`, `quantity`, `itemTotal`), `subtotal`, `shippingFee`, `discount`, `couponCode`, `total`, `paymentMethod` (`COD`, `UPI`, `Card`, `NetBanking`), `paymentStatus` (`pending`, `paid`, `failed`, `refunded`), `orderStatus` (`placed`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`), `timeline` (audit entries).

4. **Review (`Review.js`)**:
   - Fields: `user` (ref User), `product` (ref Product), `productName`, `name`, `location`, `rating` (1 to 5), `title`, `comment`, `verified`, `helpfulCount`, `status` (`approved`, `pending`, `rejected`).

5. **Contact (`Contact.js`)**:
   - Fields: `name`, `email`, `phone`, `subject`, `message`, `status` (`new`, `in_progress`, `resolved`).

6. **Newsletter (`Newsletter.js`)**:
   - Fields: `email` (unique), `isActive`, `subscribedAt`.

7. **FAQ (`FAQ.js`)**:
   - Fields: `question`, `answer`, `category`, `order`, `isActive`.

8. **Coupon (`Coupon.js`)**:
   - Fields: `code` (unique, uppercase), `discountType` (`percentage`, `flat`), `discountValue`, `minOrderAmount`, `maxDiscount`, `isActive`, `expiresAt`, `usageLimit`, `usedCount`.

---

## ⚡ Non-Blocking MongoDB & In-Memory Fallback

During development or initial deployment where MongoDB is not yet running:
- `connectDB()` executes with a short timeout without blocking the Express HTTP server from launching.
- If MongoDB is available, all queries run against live MongoDB collections.
- If MongoDB is offline, all services seamlessly operate using the high-fidelity in-memory store initialized with seed data for all 3 superfood products, FAQs, customer reviews, and discount coupons.
- Once MongoDB connects, queries automatically transition without requiring server restart.

---

## 🔑 Environment Variables

The backend uses a `.env` file at `backend/.env`.

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | Port on which the Express server listens |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `MONGODB_URI` | `mongodb://localhost:27017/agrivafoods` | MongoDB connection connection string |
| `JWT_SECRET` | *(configured)* | Secret cryptographic string for signing JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | Token validity duration |
| `CLIENT_URL` | `http://localhost:5173` | Allowed frontend origin for CORS |

---

## 🚀 How to Run the Backend

### Prerequisites
- Node.js version 18 or 20+

### Steps
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Start the server:
   - **Production Mode**:
     ```bash
     npm start
     ```
   - **Development Mode with auto-reload**:
     ```bash
     npm run dev
     ```
4. Run automated tests:
   ```bash
   npm test
   ```

### Default Credentials
- **Admin User**:
  - Email: `admin@agrivafoods.com`
  - Password: `Admin@123`
- **Demo Customer**:
  - Email: `customer@agrivafoods.com`
  - Password: `Customer@123`
