/**
 * Brixit Express Backend — Entry Point
 *
 * Registers all middleware and routes, starts the server.
 */
import express from 'express';
import path from 'path';
import { config } from './config.js';
import './serverWallet.js'; // initialise and validate BACKEND_PRIVATE_KEY on startup
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { requireAuth, requireContributor } from './middleware/auth.js';
import { authLimiter, submissionLimiter, geonamesLimiter, generalLimiter } from './utils/rateLimiter.js';

// Route imports
import authRoutes from './routes/auth.js';
import walletAuthRoutes from './routes/walletAuthVerify.js';
import geonamesRoutes from './routes/geonames.js';
import autoVerifySubmissionRoutes from './routes/autoVerifySubmission.js';
import cropsRoutes from './routes/crops.js';
import brandsRoutes from './routes/brands.js';
import locationsRoutes from './routes/locations.js';
import submissionsRoutes from './routes/submissions.js';
import leaderboardsRoutes from './routes/leaderboards.js';
import usersRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import adminCrudRoutes from './routes/adminCrud.js';
import uploadRoutes from './routes/upload.js';

const app = express();

// --- Global middleware ---
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// --- Rate limiting ---
app.use('/api', generalLimiter);
app.use('/api/auth/wallet-login', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/submissions/create', submissionLimiter);
app.use('/api/geonames', geonamesLimiter);

// --- Static file serving for uploads ---
app.use('/uploads', express.static(path.resolve(config.uploadDir)));

// --- Health check ---
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// --- Auth routes ---
app.use('/api/auth', authRoutes);                    // refresh, logout, me
app.use('/api/auth/wallet-login', walletAuthRoutes); // POST wallet certificate login

// --- Public data routes ---
app.use('/api/crops', cropsRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);

// --- Submissions (public GET + authenticated POST/DELETE) ---
app.use('/api/submissions', submissionsRoutes);
// POST /api/submissions/create requires auth + contributor (auto-verify handler)
app.use('/api/submissions/create', requireAuth as any, requireContributor as any, autoVerifySubmissionRoutes);

// --- GeoNames proxy (username is public, proxy requires auth) ---
app.use('/api/geonames', geonamesRoutes);

// --- User profile (authenticated) ---
app.use('/api/users', usersRoutes);

// --- Admin routes (authenticated + admin role) ---
app.use('/api/admin', adminRoutes);
app.use('/api/admin/crud', adminCrudRoutes);

// --- File upload (authenticated) ---
app.use('/api/upload', uploadRoutes);

// --- Error handler (must be last) ---
app.use(errorHandler);

// --- Start server ---
app.listen(config.port, () => {
  console.log(`\n🚀 Brixit backend running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Health check: http://localhost:${config.port}/api/health`);
  console.log(`\n📋 Registered routes:`);
  console.log(`   POST   /api/auth/wallet-login`);
  console.log(`   POST   /api/auth/refresh`);
  console.log(`   POST   /api/auth/logout`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   GET    /api/crops`);
  console.log(`   GET    /api/crops/categories`);
  console.log(`   GET    /api/crops/:name`);
  console.log(`   GET    /api/brands`);
  console.log(`   GET    /api/locations`);
  console.log(`   GET    /api/submissions`);
  console.log(`   GET    /api/submissions/count`);
  console.log(`   GET    /api/submissions/bounds`);
  console.log(`   GET    /api/submissions/mine`);
  console.log(`   GET    /api/submissions/:id`);
  console.log(`   POST   /api/submissions/create`);
  console.log(`   DELETE /api/submissions/:id`);
  console.log(`   GET    /api/leaderboards/brand`);
  console.log(`   GET    /api/leaderboards/crop`);
  console.log(`   GET    /api/leaderboards/location`);
  console.log(`   GET    /api/leaderboards/user`);
  console.log(`   GET    /api/geonames`);
  console.log(`   GET    /api/users/me`);
  console.log(`   PUT    /api/users/me`);
  console.log(`   GET    /api/admin/users`);
  console.log(`   GET    /api/admin/submissions/unverified`);
  console.log(`   POST   /api/admin/roles/grant`);
  console.log(`   POST   /api/admin/roles/revoke`);
  console.log(`   POST   /api/admin/submissions/:id/verify`);
  console.log(`   DELETE /api/admin/submissions/:id`);
  console.log(`   GET/POST/PUT/DELETE /api/admin/crud/crops`);
  console.log(`   GET/POST/PUT/DELETE /api/admin/crud/brands`);
  console.log(`   GET/POST/PUT/DELETE /api/admin/crud/locations`);
  console.log(`   GET/POST/PUT/DELETE /api/admin/crud/categories`);
  console.log(`   GET/POST/PUT/DELETE /api/admin/crud/location-types`);
  console.log(`   POST   /api/upload`);
  console.log('');
});

export default app;
