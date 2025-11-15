import React, { useState, useEffect } from 'react';
import Header from '../components/Layout/Header';
import InteractiveMap from '../components/Map/InteractiveMap';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Locate } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { getMapboxToken } from '../lib/getMapboxToken';

const MapView = () => {
  const { toast } = useToast();
  const { user, profileLoading } = useAuth();

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeTriggered, setNearMeTriggered] = useState(false);

  // Convert city/state/country → lat/lng
  useEffect(() => {
    async function geocodeLocation() {
      if (!user?.city || !user?.state || !user?.country) return;

      try {
        const token = await getMapboxToken();
        const query = `${user.city}, ${user.state}, ${user.country}`;
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json?access_token=${token}`
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          setUserLocation({ lat, lng });
        } else {
          console.warn('No geocode results, falling back to NYC');
          setUserLocation({ lat: 40.7128, lng: -74.006 }); // fallback
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        setUserLocation({ lat: 40.7128, lng: -74.006 }); // fallback
      }
    }

    geocodeLocation();
  }, [user]);

  const handleLocationSearch = () => {
    if (userLocation) {
      setNearMeTriggered(true);
      toast({
        title: 'Location found',
        description: 'Zooming to your saved profile location on the map.',
      });
    } else {
      toast({
        title: 'No location set',
        description: 'Please update your profile with a location to use this feature.',
        variant: 'destructive',
      });
    }
  };

  const handleNearMeHandled = () => {
    setNearMeTriggered(false);
  };

  if (profileLoading) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </main>
    </div>
  );
}

if (!user?.city || !user?.state || !user?.country) {
    // Guard in case ProtectedRoute didn’t catch it
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">No Location Set</h2>
            <p className="text-gray-600">
              Please update your profile with a city, state, and country to explore the map.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Brix Explorer</h1>
            <p className="text-gray-600">
              Explore bionutrient density measurements from refractometer readings worldwide
            </p>
          </div>

          <div className="flex space-x-3 mt-4 md:mt-0">
            <Button
              variant="outline"
              onClick={handleLocationSearch}
              className="flex items-center space-x-2"
            >
              <Locate className="w-4 h-4" />
              <span>Near Me</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1">
          <div className="lg:col-span-4">
            <Card>
              <CardContent className="p-0">
                <div className="h-[600px] w-full relative">
                  <InteractiveMap
                    userLocation={userLocation}
                    nearMeTriggered={nearMeTriggered}
                    onNearMeHandled={handleNearMeHandled}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MapView;