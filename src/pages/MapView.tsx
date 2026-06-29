import React, { useState, useEffect } from 'react';
import Header from '../components/Layout/Header';
import { PageBackground } from '../components/ui/PageBackground';
import InteractiveMap from '../components/Map/InteractiveMap';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Locate } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { getMapboxToken } from '../lib/getMapboxToken';

const MapView = () => {
  const { toast } = useToast();
  const { user } = useAuth();

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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setNearMeTriggered(true);
          toast({ title: 'Location found', description: 'Zooming to your current location.' });
        },
        () => {
          // Geolocation denied — fall back to profile location
          if (userLocation) {
            setNearMeTriggered(true);
            toast({ title: 'Location found', description: 'Zooming to your saved profile location.' });
          } else {
            toast({
              title: 'Location unavailable',
              description: user
                ? 'Allow location access or add a city to your profile.'
                : 'Allow location access to use this feature.',
              variant: 'destructive',
            });
          }
        }
      );
    } else if (userLocation) {
      setNearMeTriggered(true);
      toast({ title: 'Location found', description: 'Zooming to your saved profile location.' });
    } else {
      toast({
        title: 'Location unavailable',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
    }
  };

  const handleNearMeHandled = () => {
    setNearMeTriggered(false);
  };

  return (
    <PageBackground className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 pb-[var(--bottom-inset)]">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-on-bg-text">Brix Explorer</h1>
          <p className="mt-1 text-on-bg-body">
            See what your community is discovering near you
          </p>
        </div>

        {/* Steel-50 canvas frame separates the white map box from the page background */}
        <div className="bg-surface-canvas rounded-2xl p-2">
          <Card className="rounded-xl border border-hairline overflow-hidden shadow-sm">
            <div className="flex justify-start p-3 border-b border-hairline">
              <Button
                variant="outline"
                onClick={handleLocationSearch}
                className="flex items-center space-x-2 border-hairline text-green-fresh hover:bg-surface-canvas"
              >
                <Locate className="w-4 h-4" />
                <span>Near Me</span>
              </Button>
            </div>
            <CardContent className="p-0">
              <div className="h-[calc(100vh-16rem)] w-full relative">
                <InteractiveMap
                  userLocation={userLocation}
                  nearMeTriggered={nearMeTriggered}
                  onNearMeHandled={handleNearMeHandled}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </PageBackground>
  );
};

export default MapView;
