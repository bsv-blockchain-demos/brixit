import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  fetchAllUsers,
  upgradeToContributor,
  upgradeToAdmin,
  downgradeToContributor,
  downgradeToUser,
  type UserWithRoles,
} from '@/lib/adminApi';

export default function AdminUserManagement() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
