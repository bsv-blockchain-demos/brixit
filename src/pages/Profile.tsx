// src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Copy, Check, ArrowLeft, Shield, Eye, Sprout, Leaf, TreePine, Trash2, Pencil } from 'lucide-react';
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
const getRank = (submissions: number) => {
  if (submissions >= 100) return { Icon: TreePine, label: 'Expert' };
  if (submissions >= 10) return { Icon: Leaf, label: 'Contributor' };
  if (submissions >= 1) return { Icon: Sprout, label: 'Newcomer' };
  return { Icon: Eye, label: 'Observer' };
};

const Profile = () => {
  const { user, updateUsername, updateLocation } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [copied, setCopied] = useState(false);

  const prefersReducedMotion = useReducedMotion();
  const fadeUp = prefersReducedMotion ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

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
    if (!user) navigate('/');
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
      setFormErrors({ username: 'Could not save your name. Please try again.' });
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.country) {
      setFormErrors({ location: 'Please select a country.' });
      return;
    }
    setLoading(prev => ({ ...prev, location: true }));
    const success = await updateLocation({
      country: location.country,
      state: location.state,
      city: location.city,
    });
    setLoading(prev => ({ ...prev, location: false }));
    if (success) {
      toast({ title: 'Location updated!' });
    } else {
      setFormErrors({ location: 'Could not save your location. Please try again.' });
    }
  };

  if (!user) return null;

  const isHexKey = (user.display_name?.length ?? 0) > 20;
  const rank = getRank(user.submission_count ?? 0);
  const RankIcon = rank.Icon;
  const level = calculateLevel(user.points ?? 0);
  const progress = calculateProgress(user.points ?? 0);
  const shortKey = user.identity_key
    ? `${user.identity_key.slice(0, 16)}…${user.identity_key.slice(-16)}`
    : '';

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
            <span className="font-display font-bold text-xl text-text-dark">Profile</span>
          </div>

          {/* Profile hero */}
          <motion.div {...fadeUp}>
            <Card className="border border-hairline rounded-2xl shadow-sm">
              <CardContent className="p-6 space-y-5">
                {/* Avatar + name + role */}
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="relative">
                    <Avatar className="h-[60px] w-[60px]">
                      <AvatarFallback className="bg-blue-deep text-white text-xl font-bold">
                        {displayName?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => toast({ title: 'Photo upload coming soon' })}
                      aria-label="Edit photo"
                      className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-action-primary border-2 border-card flex items-center justify-center"
                    >
                      <Pencil className="w-3 h-3 text-white" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <h1 className="font-display font-bold text-2xl text-text-dark">
                      {isHexKey ? 'Set your display name' : displayName}
                    </h1>
                    {user.role && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-pale text-blue-deep">
                        <Shield className="w-3.5 h-3.5" />
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Identity key */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted-brown mb-1.5">
                    Public Identity Key
                  </p>
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-surface-canvas border border-hairline">
                    <code className="flex-1 min-w-0 truncate text-xs font-mono text-text-mid">{shortKey}</code>
                    <button
                      onClick={handleCopyKey}
                      className="shrink-0 p-1.5 rounded-md hover:bg-surface-canvas transition-colors"
                      aria-label="Copy identity key"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-fresh" />
                      ) : (
                        <Copy className="h-4 w-4 text-text-muted-brown" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 divide-x divide-hairline border-t border-hairline pt-4">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="text-2xl font-bold font-display text-text-dark leading-none">{level}</span>
                    <span className="text-xs text-text-muted-brown">Level</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="flex items-center gap-1.5 font-bold font-display text-text-dark leading-none">
                      <RankIcon className="w-4 h-4 text-blue-mid" />
                      {rank.label}
                    </span>
                    <span className="text-xs text-text-muted-brown">Rank</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span className="text-2xl font-bold font-display text-text-dark leading-none">{user.submission_count ?? 0}</span>
                    <span className="text-xs text-text-muted-brown">Submissions</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Settings: display name · progress · location */}
          <motion.div {...fadeUp}>
            <Card className="border border-hairline rounded-2xl shadow-sm">
              <CardContent className="p-0">
                {/* Display Name */}
                <div className="p-6">
                  <h3 className="font-display font-bold text-text-dark mb-3">Display Name</h3>
                  <form onSubmit={handleUsernameSubmit} className="flex items-start gap-3">
                    <Input
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      disabled={loading.username}
                      placeholder="Choose a display name"
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      className="shrink-0 bg-action-primary hover:bg-action-primary-hover text-white"
                      disabled={loading.username || displayName === user.display_name}
                    >
                      {loading.username ? 'Saving…' : 'Update'}
                    </Button>
                  </form>
                  {formErrors.username && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertDescription>{formErrors.username}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="border-t border-hairline" />

                {/* Progress */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-text-dark">Progress</h3>
                    <span className="text-sm text-text-muted-brown">Level {level} · {progress} / 100 pts</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-blue-pale overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-mid transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-hairline" />

                {/* Location */}
                <div className="p-6">
                  <h3 className="font-display font-bold text-text-dark mb-3">Location</h3>
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
                      className="w-full bg-action-primary hover:bg-action-primary-hover text-white"
                      disabled={loading.location}
                    >
                      {loading.location ? 'Saving…' : 'Update'}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Danger Zone */}
          <motion.div {...fadeUp}>
            <Card className="border border-hairline rounded-2xl shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 className="w-4 h-4 text-action-primary" />
                  <p className="text-sm font-semibold text-action-primary">Danger Zone</p>
                </div>
                <p className="text-sm text-text-muted-brown mb-4">
                  Account deletion is not available at this time.
                </p>
                <Button
                  disabled
                  className="w-full bg-surface-canvas text-text-muted-brown border border-hairline hover:bg-surface-canvas"
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

export default Profile;
