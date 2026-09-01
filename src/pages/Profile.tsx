// src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { ArrowLeft, Shield, Eye, Sprout, Leaf, TreePine, Pencil, ClipboardList, BadgeCheck, Store } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useToast } from '../hooks/use-toast';
import { IdentityKey } from '../components/common/IdentityKey';
import { IconStatGrid } from '../components/common/IconStatGrid';
import {
  useMySubmissionsCountQuery,
  useMySubmissionsCropIdsQuery,
  useMySubmissionsVenueIdsQuery,
} from '../hooks/useSubmissions';
import Header from '../components/Layout/Header';

const calculateLevel = (points: number) => Math.floor(points / 100) + 1;
const calculateProgress = (points: number) => points % 100;
const getRank = (submissions: number) => {
  if (submissions >= 100) return { Icon: TreePine, label: 'Expert' };
  if (submissions >= 10) return { Icon: Leaf, label: 'Contributor' };
  if (submissions >= 1) return { Icon: Sprout, label: 'Newcomer' };
  return { Icon: Eye, label: 'Observer' };
};

const Profile = () => {
  const { user, updateUsername } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');

  const prefersReducedMotion = useReducedMotion();
  const fadeUp = prefersReducedMotion ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

  // Keep local displayName in sync when the profile finishes loading or changes
  useEffect(() => {
    setDisplayName(user?.display_name || '');
  }, [user?.display_name]);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState({ username: false });

  const navigate = useNavigate();
  const { toast } = useToast();

  // Moved off the My Readings page: these describe you, so they belong with
  // the level and rank rather than above a table of rows.
  const totalQuery = useMySubmissionsCountQuery(user?.id ? { userId: user.id } : undefined);
  const verifiedQuery = useMySubmissionsCountQuery(user?.id ? { userId: user.id, verified: true } : undefined);
  const cropIdsQuery = useMySubmissionsCropIdsQuery(user?.id);
  const venueIdsQuery = useMySubmissionsVenueIdsQuery(user?.id);
  const uniqueCrops = new Set(cropIdsQuery.data ?? []).size;
  const uniqueStores = new Set(venueIdsQuery.data ?? []).size;

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

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

  if (!user) return null;

  const isHexKey = (user.display_name?.length ?? 0) > 20;
  const rank = getRank(user.submission_count ?? 0);
  const RankIcon = rank.Icon;
  const level = calculateLevel(user.points ?? 0);
  const progress = calculateProgress(user.points ?? 0);

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
                  <div className="flex items-center rounded-lg px-3 py-2 bg-surface-canvas border border-hairline">
                    <IdentityKey
                      value={user.identity_key}
                      label="Public identity key"
                      className="flex-1 text-text-mid"
                    />
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
                    <span className="text-xs text-text-muted-brown">Readings</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Settings: display name · progress */}
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

                {/* Reading stats, moved here from the My Readings page. */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-text-dark">Your readings</h3>
                    <button
                      onClick={() => navigate('/data?scope=mine')}
                      className="text-sm font-medium text-action-primary hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <IconStatGrid stats={[
                    { icon: ClipboardList, value: totalQuery.data ?? 0,    label: 'Total Readings' },
                    { icon: BadgeCheck,    value: verifiedQuery.data ?? 0, label: 'Verified Readings' },
                    { icon: Sprout,        value: uniqueCrops,             label: 'Unique Crop Types' },
                    { icon: Store,         value: uniqueStores,            label: 'Unique Stores' },
                  ]} />
                </div>

              </CardContent>
            </Card>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
