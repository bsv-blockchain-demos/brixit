import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  createUser,
  fetchAllUsers,
  grantRole,
  revokeRole,
  type AdminCreateUserInput,
  type UserWithRoles,
} from '@/lib/adminApi';

export default function AdminUserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState<AdminCreateUserInput>({
    email: '',
    password: '',
    displayName: '',
    country: '',
    state: '',
    city: '',
  });

  const onChange = (key: keyof AdminCreateUserInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (e: any) {
      toast({ title: 'Failed to load users', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await createUser(form);
      if (res.success) {
        toast({ title: 'User created', description: res.message ?? 'New user account created.' });
        setForm({ email: '', password: '', displayName: '', country: '', state: '', city: '' });
        void loadUsers();
      } else {
        toast({ title: 'Create failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Create failed', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleGrant = async (userId: string, role: 'admin' | 'contributor') => {
    try {
      const res = await grantRole(userId, role);
      if (res.success) {
        toast({ title: 'Role granted', description: res.message ?? '' });
        void loadUsers();
      } else {
        toast({ title: 'Grant failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Grant failed', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleRevoke = async (userId: string, role: 'admin' | 'contributor') => {
    try {
      const res = await revokeRole(userId, role);
      if (res.success) {
        toast({ title: 'Role revoked', description: res.message ?? '' });
        void loadUsers();
      } else {
        toast({ title: 'Revoke failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Revoke failed', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <form onSubmit={handleCreate} className="space-y-4 border rounded p-4">
        <h2 className="text-lg font-semibold">Create New User</h2>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={form.email} onChange={onChange('email')} type="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" value={form.password} onChange={onChange('password')} type="password" required />
        </div>
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input id="displayName" value={form.displayName} onChange={onChange('displayName')} required />
        </div>
        <div>
          <Label htmlFor="country">Country (optional)</Label>
          <Input id="country" value={form.country} onChange={onChange('country')} />
        </div>
        <div>
          <Label htmlFor="state">State (optional)</Label>
          <Input id="state" value={form.state} onChange={onChange('state')} />
        </div>
        <div>
          <Label htmlFor="city">City (optional)</Label>
          <Input id="city" value={form.city} onChange={onChange('city')} />
        </div>
        <Button type="submit" disabled={creating}>
          {creating ? 'Creating...' : 'Create User'}
        </Button>
      </form>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Existing Users</h2>
          <Button variant="ghost" onClick={() => loadUsers()} disabled={loadingUsers}>
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
                <div key={u.id} className="border rounded p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium">{u.display_name ?? u.id}</div>
                    <div className="text-muted-foreground">
                      Roles: {(u.roles ?? []).join(', ') || 'user'}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!hasContributor && (
                      <Button size="sm" onClick={() => handleGrant(u.id, 'contributor')}>
                        Make contributor
                      </Button>
                    )}
                    {!hasAdmin && (
                      <Button size="sm" onClick={() => handleGrant(u.id, 'admin')}>
                        Make admin
                      </Button>
                    )}
                    {hasContributor && (
                      <Button size="sm" variant="secondary" onClick={() => handleRevoke(u.id, 'contributor')}>
                        Revoke contributor
                      </Button>
                    )}
                    {hasAdmin && (
                      <Button size="sm" variant="secondary" onClick={() => handleRevoke(u.id, 'admin')}>
                        Revoke admin
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
