// src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Copy, Check, ArrowLeft } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useToast } from '../hooks/use-toast';
import LocationSelector from '../components/common/LocationSelector';
import Header from '../components/Layout/Header';

interface LocationData {
  country: string;
  countryCode: string;
  state: string;
  stateCode: string;
  city: string;
}

const calculateLevel = (points: number) => Math.floor(points / 100) + 1;
const calculateProgress = (points: number) => points % 100;
const getBadge = (submissions: number) => {
  if (submissions >= 100) return { emoji: '🌳', label: 'Expert' };
  if (submissions >= 10) return { emoji: '🌿', label: 'Contributor' };
  if (submissions >= 1) return { emoji: '🌱', label: 'Newcomer' };
  return { emoji: '👀', label: 'Observer' };
};

const Profile = () => {
  const { user, updateUsername, updateLocation, authError } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [copied, setCopied] = useState(false);

  const prefersReducedMotion = useReducedMotion();
  const fadeUp = prefersReducedMotion ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };
  const stagger = prefersReducedMotion ? {} : { initial: 'hidden', animate: 'visible', variants: { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } } };
  const staggerChild = prefersReducedMotion ? {} : { variants: { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } } };

  // Keep local displayName in sync when the profile finishes loading or changes
  useEffect(() => {
    setDisplayName(user?.display_name || '');
  }, [user?.display_name]);

  // create a LocationData object compatible with LocationSelector
  const [location, setLocation] = useState<LocationData>({
    country: user?.country || '',
    countryCode: '',
    state: user?.state || '',
    stateCode: '',
    city: user?.city || '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState({ username: false, location: false });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const handleCopyKey = async () => {
    if (!user?.identity_key) return;
    await navigator.clipboard.writeText(user.identity_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || displayName.length < 3) {
      setFormErrors({ username: 'Name must be at least 3 characters' });
      return;
    }
    setLoading(prev => ({ ...prev, username: true }));
    const success = await updateUsername(displayName.trim());
    setLoading(prev => ({ ...prev, username: false }));
    if (success) {
      toast({ title: 'Name updated!' });
    } else {
      setFormErrors({ username: authError || 'Failed to update name.' });
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.country || !location.state || !location.city) {
      setFormErrors({ location: 'Please complete all fields' });
      return;
    }
    setLoading(prev => ({ ...prev, location: true }));
    // Pass only fields that exist in DB
    const success = await updateLocation({
      country: location.country,
      state: location.state,
      city: location.city,
    });
    setLoading(prev => ({ ...prev, location: false }));
    if (success) {
      toast({ title: 'Location updated!' });
    } else {
      setFormErrors({ location: authError || 'Failed to update location.' });
    }
  };

  if (!user) return null;

  const isHexKey = (user.display_name?.length ?? 0) > 20;
  const badge = getBadge(user.submission_count ?? 0);
  const level = calculateLevel(user.points ?? 0);
  const progress = calculateProgress(user.points ?? 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Back Button */}
          <motion.div {...fadeUp}>
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </motion.div>

          {/* Profile Hero Card */}
          <motion.div {...fadeUp}>
            <Card className="border border-green-pale rounded-2xl shadow-sm">
              <CardContent className="p-6 space-y-5">
                <div className="flex flex-col items-center text-center gap-3">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-green-deep text-white text-2xl font-bold">
                      {displayName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="font-display font-bold text-2xl text-text-dark">
                      {isHexKey ? 'Set your display name' : displayName}
                    </h1>
                    {user.role && (
                      <span className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium bg-green-pale text-green-mid">
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Identity key */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted-green mb-1.5">Public Identity Key</p>
                </div>
                <div className="flex items-center gap-2 border border-green-pale rounded-lg px-3 py-2">
                  <code className="flex-1 text-xs break-all font-mono text-text-mid">
                    {user.identity_key}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className="shrink-0 p-1.5 rounded-md hover:bg-accent transition-colors"
                    aria-label="Copy identity key"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-fresh" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 divide-x divide-green-pale">
                  <div className="p-3 text-center">
                    <div className="text-2xl font-bold font-display text-text-dark">{level}</div>
                    <div className="text-xs text-text-muted-green">Level</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-2xl">{badge.emoji}</div>
                    <div className="text-xs text-text-muted-green">{badge.label}</div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-2xl font-bold font-display text-text-dark">{user.submission_count ?? 0}</div>
                    <div className="text-xs text-text-muted-green">Submissions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Staggered cards */}
          <motion.div className="space-y-6" {...stagger}>
            {/* Display Name Card */}
            <motion.div {...staggerChild}>
              <Card className="border border-green-pale rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display text-text-dark">Display Name</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUsernameSubmit} className="space-y-4">
                    {formErrors.username && (
                      <Alert variant="destructive">
                        <AlertDescription>{formErrors.username}</AlertDescription>
                      </Alert>
                    )}
                    <Input
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      disabled={loading.username}
                      placeholder="Choose a display name"
                    />
                    <Button
                      type="submit"
                      className="w-full bg-green-fresh hover:bg-green-mid text-white"
                      disabled={loading.username || displayName === user.display_name}
                    >
                      {loading.username ? 'Saving...' : 'Update Name'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Progress Card */}
            <motion.div {...staggerChild}>
              <Card className="border border-green-pale rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display font-semibold text-text-dark">Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-mid">Level {level}</span>
                    <span className="text-sm text-text-muted-green">{progress} / 100 pts</span>
                  </div>
                  <div className="w-full h-3 rounded-full" style={{ background: 'var(--green-pale)' }}>
                    <div
                      className="h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        background: 'var(--green-fresh)',
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Location Card */}
            <motion.div {...staggerChild}>
              <Card className="border border-green-pale rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="font-display text-text-dark">Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLocationSubmit} className="space-y-4">
                    <LocationSelector
                      value={location}
                      onChange={setLocation}
                      disabled={loading.location}
                    />
                    {formErrors.location && (
                      <p className="text-sm text-destructive">{formErrors.location}</p>
                    )}
                    <Button
                      type="submit"
                      className="w-full bg-green-fresh hover:bg-green-mid text-white"
                      disabled={loading.location}
                    >
                      {loading.location ? 'Saving...' : 'Update Location'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Danger Zone */}
            <motion.div {...staggerChild}>
              <Card className="border-destructive/30 bg-destructive/5 rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-destructive mb-1">Danger Zone</p>
                  <p className="text-sm text-text-muted-green mb-3">
                    Account deletion is not available at this time.
                  </p>
                  <Button variant="destructive" disabled className="opacity-50">
                    Delete Account
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
