// src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Award, ArrowLeft } from 'lucide-react';
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
  if (submissions >= 100) return '🌳 Expert';
  if (submissions >= 10) return '🌿 Contributor';
  if (submissions >= 1) return '🌱 Newcomer';
  return '👀 Observer';
};

const Profile = () => {
  const { user, updateUsername, updateLocation, authError } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Back Button */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-green-600 text-white flex items-center justify-center text-2xl font-bold">
                {displayName?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{displayName}</h1>
            {user.role && (
              <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                <Award className="h-4 w-4 mr-1" />
                {user.role === 'admin' ? 'Administrator' : user.role}
              </span>
            )}
          </div>

          {/* Gamified Points */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Level</p>
                  <div className="text-2xl font-bold">
                    {calculateLevel(user.points ?? 0)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Badge</p>
                  <div className="text-xl">
                    {getBadge(user.submission_count ?? 0)}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {calculateProgress(user.points ?? 0)} / 100 points to next level
                </p>
                <div className="w-full bg-gray-200 h-3 rounded-full">
                  <div
                    className="h-3 bg-green-600 rounded-full"
                    style={{
                      width: `${calculateProgress(user.points ?? 0)}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editable Name */}
          <Card>
            <CardHeader>
              <CardTitle>Display Name</CardTitle>
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
                />
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={loading.username || displayName === user.display_name}
                >
                  {loading.username ? 'Saving...' : 'Update Name'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLocationSubmit} className="space-y-4">
                <LocationSelector
                  value={location}
                  onChange={setLocation}
                  disabled={loading.location}
                />
                {formErrors.location && (
                  <p className="text-sm text-red-600">{formErrors.location}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={loading.location}
                >
                  {loading.location ? 'Saving...' : 'Update Location'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Info (Read-only) */}
          <Card>
            <CardHeader>
              <CardTitle>Account Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={user.email || ''} disabled readOnly className="bg-gray-100" />
              </div>
              <div>
                <Label>Password</Label>
                <Input value="••••••••" disabled readOnly className="bg-gray-100" />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Account deletion is not available at this time.
              </p>
              <Button variant="destructive" disabled className="opacity-50 w-full">
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
