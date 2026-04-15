import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../components/Layout/Header';
import InteractiveMap from '../components/Map/InteractiveMap';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Locate, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { getMapboxToken } from '../lib/getMapboxToken';

const MapView = () => {
  const { toast } = useToast();
  const { user, profileLoading } = useAuth();
  const navigate = useNavigate();

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
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-green-mid animate-spin mx-auto mb-3" />
            <p className="text-text-muted-green">Loading your profile...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user?.city || !user?.state || !user?.country) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 rounded-2xl bg-green-deep flex items-center justify-center mx-auto mb-6">
                <MapPin className="w-10 h-10 text-white" />
              </div>
              <h2 className="font-display font-bold text-2xl text-text-dark mb-3">
                Set Your Location
              </h2>
              <p className="text-text-mid mb-8">
                Add your city to your profile to explore scores from
                your community and discover nutritious produce nearby.
              </p>
              <Button
                onClick={() => navigate('/profile')}
                className="bg-primary text-primary-foreground hover:bg-green-mid px-6"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Update My Profile
              </Button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-text-dark mb-2">Brix Explorer</h1>
            <p className="text-text-mid">
              See what your community is discovering near you
            </p>
          </div>

          <div className="flex space-x-3 mt-4 md:mt-0">
            <Button
              variant="outline"
              onClick={handleLocationSearch}
              className="flex items-center space-x-2 border-green-pale text-green-fresh hover:bg-green-mist"
            >
              <Locate className="w-4 h-4" />
              <span>Near Me</span>
            </Button>
          </div>
        </div>

        <Card className="rounded-2xl border border-green-pale overflow-hidden shadow-sm">
          <CardContent className="p-0">
            <div className="h-[calc(100vh-13rem)] w-full relative">
              <InteractiveMap
                userLocation={userLocation}
                nearMeTriggered={nearMeTriggered}
                onNearMeHandled={handleNearMeHandled}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MapView;
