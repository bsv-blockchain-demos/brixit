import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (avoid dotenv dependency)
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file is optional
  }
}

loadEnv();

const DEFAULT_JWT_PLACEHOLDER = 'change-this-to-a-strong-random-secret-in-production';
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === DEFAULT_JWT_PLACEHOLDER) {
  throw new Error(
    'JWT_SECRET is not set or is still the default placeholder. ' +
    'Set a strong random value in your .env file before starting the server.'
  );
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Auth
  jwtSecret,
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '1h',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',

  // CORS — comma-separated list of allowed frontend origins
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),

  // BSV Wallet
  commonsourceServerKey: process.env.COMMONSOURCE_SERVER_KEY || '',

  // Auto-verification
  autoVerifyUserId: process.env.AUTO_VERIFY_USER_ID || '',

  // GeoNames
  geonamesUsername: process.env.GEONAMES_USERNAME || '',

  // Storage
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
} as const;
