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
  grantRole,
  revokeRole,
  type AdminCreateUserInput,
  type UserWithRoles,
  type AppRole,
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

  const handleGrant = async (userId: string, role: Extract<AppRole, 'admin' | 'contributor'>) => {
    try {
      const res = await grantRole(userId, role);
      if (res.success) {
        toast({ title: 'Role granted', description: res.message ?? `${role} role granted successfully.` });
        await loadUsers();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleRevoke = async (userId: string, role: Extract<AppRole, 'admin' | 'contributor'>) => {
    try {
      const res = await revokeRole(userId, role);
      if (res.success) {
        toast({ title: 'Role revoked', description: res.message ?? `${role} role revoked successfully.` });
        await loadUsers();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
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
              const hasAdmin = u.roles?.includes('admin');
              const hasContributor = u.roles?.includes('contributor');

              return (
                <div key={u.id} className="border rounded p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="text-sm">
                    <div className="font-medium text-base mb-1">{u.display_name ?? u.id}</div>
                    <div className="text-muted-foreground flex flex-wrap gap-1 items-center">
                      <span>Roles:</span>
                      {(u.roles ?? []).map(role => (
                        <Badge key={role} variant="secondary">{role}</Badge>
                      ))}
                      {(!u.roles || u.roles.length === 0) && <Badge variant="outline">user</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-muted-foreground min-w-[80px]">Contributor:</span>
                      {!hasContributor ? (
                        <Button size="sm" variant="outline" onClick={() => handleGrant(u.id, 'contributor')}>
                          Make contributor
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => handleRevoke(u.id, 'contributor')}>
                          Revoke contributor
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-muted-foreground min-w-[80px]">Admin:</span>
                      {!hasAdmin ? (
                        <Button size="sm" variant="outline" onClick={() => handleGrant(u.id, 'admin')}>
                          Make admin
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => handleRevoke(u.id, 'admin')}>
                          Revoke admin
                        </Button>
                      )}
                    </div>
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
