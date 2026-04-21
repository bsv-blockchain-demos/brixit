export interface BrixDataPoint {
  id: string;
  brixLevel: number;
  verified: boolean;
  verifiedAt: string | null; // ISO timestamp
  variety: string;
  cropType: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  placeName: string;
  streetAddress: string;
  // Add the new fields here
  city: string;
  state: string;
  country: string;
  brandName: string;
  submittedBy: string;
  userId?: string;
  verifiedBy: string;
  submittedAt: string;
  outlier_notes: string;
  images: string[];
  poorBrix: number | null;
  averageBrix: number | null;
  goodBrix: number | null;
  excellentBrix: number | null;
  name_normalized?: string;
  purchaseDate: string | null;

  cropId: string;
  placeId: string;
  brandId: string;
  verifiedByUserId: string;

  cropLabel: string | null;
  brandLabel: string | null;
}

// Data format returned from API, aligned with BrixDataPoint
export interface FormattedSubmission {
  id: string;
  brixLevel: number;
  verified: boolean;
  verifiedAt: string | null;
  label: string;
  cropType: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  placeName: string;
  brandName: string;
  submittedBy: string;
  verifiedBy: string;
  submittedAt: string;
  images: string[];
  notes: string | null;
  place: { id: string; label: string; latitude: number | null; longitude: number | null; } | null;
  crop: { id: string; name: string; category: string; excellent_brix: number | null; good_brix: number | null; average_brix: number | null; } | null;
  location: { id: string; name: string; } | null;
  brand: { id: string; name: string; } | null;
  user: { id: string; display_name: string; } | null;
  verifier: { id: string; display_name: string; } | null;
  excellentBrix: number | null;
  goodBrix: number | null;
  averageBrix: number | null;
  poorBrix: number | null;
  userId: string;
  outlier_notes: string | null;
  variety: string | null;
}

export interface BrixThresholds {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  joinDate: string;
  totalSubmissions: number;
  verifiedSubmissions: number;
  badges: Badge[];
  isAdmin?: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  requirement: number;
  category: 'submissions' | 'accuracy' | 'diversity' | 'community';
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

export interface MapFilter {
  cropTypes: string[]; // Consistent array for selected crop types
  brixRange: [number, number];
  dateRange: [string, string];
  verifiedOnly: boolean;
  submittedBy: string;
  place: string;
  brand: string;
  hasImage: boolean;
  category: string;
  location: string; // Store/location name
  city?: string; // Geographic city filter
  state?: string; // Geographic state filter
  country?: string; // Geographic country filter
}