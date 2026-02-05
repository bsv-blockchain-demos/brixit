-- Add location coordinates to users table for storing raw lat/lng from wallet
ALTER TABLE public.users
ADD COLUMN location_lat double precision,
ADD COLUMN location_lng double precision;

-- Add check constraints for valid coordinates
ALTER TABLE public.users
ADD CONSTRAINT location_lat_check CHECK (location_lat >= -90 AND location_lat <= 90),
ADD CONSTRAINT location_lng_check CHECK (location_lng >= -180 AND location_lng <= 180);

-- Create index for location-based queries
CREATE INDEX idx_users_location ON public.users(location_lat, location_lng)
WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

COMMENT ON COLUMN public.users.location_lat IS
'Latitude from wallet UserData, stored for future proximity features';
COMMENT ON COLUMN public.users.location_lng IS
'Longitude from wallet UserData, stored for future proximity features';
