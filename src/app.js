import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware.js';
import { env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// Security HTTP headers with cross-origin resource policy for media/images
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration
const allowedOrigins = [
  env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173'
]
  .filter(Boolean)
  .map(url => url.trim().replace(/\/$/, ''));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.trim().replace(/\/$/, '');
      if (
        allowedOrigins.includes(cleanOrigin) ||
        allowedOrigins.includes('*') ||
        cleanOrigin.endsWith('.netlify.app')
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Razorpay-Signature']
  })
);

// HTTP Request Logger
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Request body parsers
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploaded images
app.use('/uploads', express.static(uploadsDir));

// Also serve public assets fallback if available
const assetsDir = path.resolve(__dirname, '../../../scratch/agravafoods/public/assets');
if (fs.existsSync(assetsDir)) {
  app.use('/assets', express.static(assetsDir));
}

// Apply global rate limiting to /api endpoints
app.use('/api', apiLimiter);

// Root informational endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'AgrivaFoods E-Commerce Backend API',
    version: '1.0.0',
    documentation: '/api/health',
    status: 'active'
  });
});

// API Routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export default app;
