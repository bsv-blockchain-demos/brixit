import type { Page } from '@playwright/test';

// ── Shared mock data ─────────────────────────────────────────────────────────

export const MOCK_CROPS = [
  { id: 'crop-1', name: 'bell_pepper', label: 'Bell Peppers', poorBrix: 4,  averageBrix: 6,  goodBrix: 8,  excellentBrix: 10 },
  { id: 'crop-2', name: 'tomato',      label: 'Tomato',       poorBrix: 4,  averageBrix: 6,  goodBrix: 8,  excellentBrix: 12 },
  { id: 'crop-3', name: 'apple',       label: 'Apple',        poorBrix: 6,  averageBrix: 10, goodBrix: 14, excellentBrix: 18 },
];

export const MOCK_BRANDS = [
  { id: 'brand-1', name: 'olivias_organics', label: "Olivia's Organics" },
  { id: 'brand-2', name: '4_earth_farms',    label: '4 Earth Farms' },
];

export const MOCK_LOCATIONS = [
  { id: 'loc-1', name: 'whole_foods', label: 'Whole Foods' },
  { id: 'loc-2', name: 'aldi',        label: 'Aldi' },
];

export const MOCK_LEADERBOARD_CROPS = [
  { rank: 1, crop_name: 'apple',       crop_label: 'Apple',       average_brix: 18.5, submission_count: 120 },
  { rank: 2, crop_name: 'tomato',      crop_label: 'Tomato',      average_brix: 11.2, submission_count: 95 },
  { rank: 3, crop_name: 'bell_pepper', crop_label: 'Bell Peppers', average_brix: 7.8,  submission_count: 44 },
];

export const MOCK_LEADERBOARD_BRANDS = [
  { rank: 1, brand_name: 'olivias_organics', brand_label: "Olivia's Organics", average_brix: 16.1, submission_count: 80 },
  { rank: 2, brand_name: '4_earth_farms',    brand_label: '4 Earth Farms',     average_brix: 14.3, submission_count: 55 },
];

export const MOCK_LEADERBOARD_LOCATIONS = [
  { rank: 1, location_name: 'Whole Foods', average_brix: 15.9, submission_count: 200 },
  { rank: 2, location_name: 'Aldi',        average_brix: 12.4, submission_count: 140 },
];

export const MOCK_LEADERBOARD_USERS = [
  { rank: 1, display_name: 'Test Contributor', average_brix: 14.2, submission_count: 5 },
];

// ── Route mock helpers ────────────────────────────────────────────────────────

/** Mock all static reference data (crops, brands, locations). */
export async function mockStaticData(page: Page) {
  await page.route('**/api/crops',     route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CROPS) }));
  await page.route('**/api/brands',    route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BRANDS) }));
  await page.route('**/api/locations', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_LOCATIONS) }));
}

/** Mock all leaderboard endpoints. Regex patterns handle URLs with query params (e.g. ?limit=20&offset=0). */
export async function mockLeaderboards(page: Page) {
  await page.route(/\/api\/leaderboards\/crop(\?.*)?$/,     route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_LEADERBOARD_CROPS) }));
  await page.route(/\/api\/leaderboards\/brand(\?.*)?$/,    route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_LEADERBOARD_BRANDS) }));
  await page.route(/\/api\/leaderboards\/location(\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_LEADERBOARD_LOCATIONS) }));
  await page.route(/\/api\/leaderboards\/user(\?.*)?$/,     route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_LEADERBOARD_USERS) }));
}
