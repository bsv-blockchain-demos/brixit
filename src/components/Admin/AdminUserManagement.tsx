import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import LocationSelector from '@/components/common/LocationSelector';
import {
  createUser,
  fetchAllUsers,
  upgradeToContributor,
  upgradeToAdmin,
  downgradeToContributor,
  downgradeToUser,
  type AdminCreateUserInput,
  type UserWithRoles,
} from '@/lib/adminApi';
import { LocationData } from '@/lib/locationServiceforRegister';

export default function AdminUserManagement() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<AdminCreateUserInput>({
    email: '',
    password: '',
    displayName: '',
    country: '',
    countryCode: '',
    state: '',
    stateCode: '',
    city: '',
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (e: any) {
      toast({
        title: 'Failed to load users',
        description: e?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleLocationChange = (location: LocationData) => {
    setFormData(prev => ({
      ...prev,
      country: location.country,
      countryCode: location.countryCode,
      state: location.state,
      stateCode: location.stateCode,
      city: location.city,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.displayName) {
      toast({
        title: 'Validation Error',
        description: 'Email, password, and display name are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await createUser(formData);
      if (res.success) {
        toast({ title: 'User created', description: res.message ?? 'User account created successfully.' });
        setFormData({
          email: '',
          password: '',
          displayName: '',
          country: '',
          countryCode: '',
          state: '',
          stateCode: '',
          city: '',
        });
        await loadUsers();
      } else {
        toast({ title: 'Creation failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleUpgradeToContributor = async (userId: string) => {
    try {
      const res = await upgradeToContributor(userId);
      if (res.success) {
        toast({ title: 'User upgraded', description: 'User is now a contributor.' });
        await loadUsers();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleUpgradeToAdmin = async (userId: string) => {
    try {
      const res = await upgradeToAdmin(userId);
      if (res.success) {
        toast({ title: 'User upgraded', description: 'User is now an admin.' });
        await loadUsers();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDowngradeToContributor = async (userId: string) => {
    try {
      const res = await downgradeToContributor(userId);
      if (res.success) {
        toast({ title: 'User downgraded', description: 'User is now a contributor.' });
        await loadUsers();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDowngradeToUser = async (userId: string) => {
    try {
      const res = await downgradeToUser(userId);
      if (res.success) {
        toast({ title: 'User downgraded', description: 'User is now a regular user.' });
        await loadUsers();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  // Helper to determine user's current role level
  const getUserRole = (roles: string[] | null | undefined): 'user' | 'contributor' | 'admin' => {
    if (!roles || roles.length === 0) return 'user';
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('contributor')) return 'contributor';
    return 'user';
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'contributor': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Create New User</h2>
        <form onSubmit={handleCreate} className="space-y-4 border rounded p-4">
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>Location (Optional)</Label>
            <LocationSelector
              value={{
                country: formData.country || '',
                countryCode: formData.countryCode || '',
                state: formData.state || '',
                stateCode: formData.stateCode || '',
                city: formData.city || '',
              }}
              onChange={handleLocationChange}
              showAutoDetect={false}
            />
          </div>
          <Button type="submit">Create User</Button>
        </form>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">All Users</h2>
          <Button variant="ghost" onClick={() => loadUsers()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const currentRole = getUserRole(u.roles);

              return (
                <div key={u.id} className="border rounded p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="text-sm flex-1">
                    <div className="font-medium text-base mb-1">{u.display_name ?? u.id}</div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <span>Current role:</span>
                      <Badge variant={getRoleBadgeVariant(currentRole)}>
                        {currentRole}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {currentRole === 'user' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleUpgradeToContributor(u.id)}
                      >
                        Make Contributor
                      </Button>
                    )}
                    {currentRole === 'contributor' && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleUpgradeToAdmin(u.id)}
                        >
                          Upgrade to Admin
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => handleDowngradeToUser(u.id)}
                        >
                          Downgrade to User
                        </Button>
                      </>
                    )}
                    {currentRole === 'admin' && (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => handleDowngradeToContributor(u.id)}
                      >
                        Downgrade to Contributor
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
