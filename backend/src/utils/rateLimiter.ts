/**
 * Rate limiter instances used across all API routes.
 *
 * Uses express-rate-limit with the default in-memory store.
 * To switch to Redis, replace the `store` option in each limiter:
 *
 *   import RedisStore from 'rate-limit-redis';
 *   import { createClient } from 'ioredis';
 *   const redisClient = createClient({ url: process.env.REDIS_URL });
 *   const store = new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) });
 *
 *   Then add `store` to each rateLimit() call below.
 */
import rateLimit from 'express-rate-limit';

/** 15 requests per 15 minutes — brute force protection for wallet login and token refresh */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

/** 100 requests per hour — submission spam prevention */
export const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Submission limit reached. Please try again later.' },
});

/** 60 requests per minute — protects GeoNames third-party API quota */
export const geonamesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many geocoding requests. Please slow down.' },
});

/** 200 requests per minute — blanket DoS protection for all other API routes */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});
