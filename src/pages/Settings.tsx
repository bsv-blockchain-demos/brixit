// src/pages/Settings.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Trash2, Sun, Moon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import LocationSelector from '../components/common/LocationSelector';
import { useToast } from '../hooks/use-toast';
import Header from '../components/Layout/Header';

interface LocationData {
  country: string;
  countryCode: string;
  state: string;
  stateCode: string;
  city: string;
}

const Settings = () => {
  const { user, updateLocation } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const prefersReducedMotion = useReducedMotion();
  const fadeUp = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

  const [location, setLocation] = useState<LocationData>({
    country: user?.country || '',
    countryCode: '',
    state: user?.state || '',
    stateCode: '',
    city: user?.city || '',
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.country) {
      setLocationError('Please select a country.');
      return;
    }
    setLocationError(null);
    setSavingLocation(true);
    const success = await updateLocation({
      country: location.country,
      state: location.state,
      city: location.city,
    });
    setSavingLocation(false);
    if (success) {
      toast({ title: 'Location updated!' });
    } else {
      setLocationError('Could not save your location. Please try again.');
    }
  };

  if (!user) return null;

  // resolvedTheme so a system-themed session still highlights the right option.
  const active = (resolvedTheme ?? theme) === 'dark' ? 'dark' : 'light';
  const THEMES = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
  ];

  return (
    <div className="min-h-screen bg-surface-canvas">
      <Header />
      <div className="pt-6 px-4 sm:px-6 lg:px-8" style={{ paddingBottom: 'calc(2rem + var(--bottom-inset))' }}>
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Back + page title */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="-ml-2 text-text-dark hover:bg-transparent"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-display font-bold text-xl text-text-dark">Settings</span>
          </div>

          {/* Appearance. The account menu keeps its quick toggle; this is the
              explicit picker, so the current choice is visible rather than
              inferred from an icon. Only Light and Dark: the app mounts
              ThemeProvider with enableSystem={false}, so there is no System
              option to honour. */}
          <motion.div {...fadeUp}>
            <Card className="border border-hairline rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-display font-bold text-text-dark mb-1">Appearance</h3>
                <p className="text-sm text-text-muted-brown mb-4">
                  Choose how BRIXit looks on this device.
                </p>
                <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3">
                  {THEMES.map(({ value, label, icon: Icon }) => {
                    const selected = active === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTheme(value)}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                          selected
                            ? 'border-action-primary bg-select-bg text-select-fg'
                            : 'border-hairline text-text-mid hover:bg-surface-canvas'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Location, moved off Profile: it is a preference that scopes the
              leaderboards and the map, not a fact about you like your rank. */}
          <motion.div {...fadeUp}>
            <Card className="border border-hairline rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-display font-bold text-text-dark mb-1">Location</h3>
                <p className="text-sm text-text-muted-brown mb-4">
                  Sets the default area for rankings and the map.
                </p>
                <form onSubmit={handleLocationSubmit} className="space-y-4">
                  <LocationSelector
                    value={location}
                    onChange={setLocation}
                    disabled={savingLocation}
                  />
                  {locationError && <p className="text-sm text-destructive">{locationError}</p>}
                  <Button
                    type="submit"
                    className="w-full bg-action-primary hover:bg-action-primary-hover text-white"
                    disabled={savingLocation}
                  >
                    {savingLocation ? 'Saving…' : 'Update'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Closing your account (was "Danger Zone" on the Profile page) */}
          <motion.div {...fadeUp}>
            <Card className="border border-hairline rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 className="w-4 h-4 text-action-danger" />
                  <p className="text-sm font-semibold text-action-danger">Closing your account</p>
                </div>
                <p className="text-sm text-text-muted-brown mb-4">
                  Account deletion is not available at this time.
                </p>
                <Button
                  variant="destructive"
                  disabled
                  className="w-full"
                >
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
