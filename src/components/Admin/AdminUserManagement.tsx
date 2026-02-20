import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchAllUsers,
  upgradeToContributor,
  upgradeToAdmin,
  downgradeToContributor,
  downgradeToUser,
  type UserWithRoles,
} from '@/lib/adminApi';

const PAGE_SIZE = 20;

export default function AdminUserManagement() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async (searchQ = committedSearch, pg = page) => {
    setLoading(true);
    try {
      const result = await fetchAllUsers({
        search: searchQ || undefined,
        limit: PAGE_SIZE,
        offset: (pg - 1) * PAGE_SIZE,
      });
      setUsers(result.data);
      setTotal(result.total);
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

  useEffect(() => { void load(); }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
      setCommittedSearch(search);
      void load(search, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void load(committedSearch, newPage);
  };

  const handleUpgradeToContributor = async (userId: string) => {
    try {
      const res = await upgradeToContributor(userId);
      if (res.success) {
        toast({ title: 'User upgraded', description: 'User is now a contributor.' });
        void load();
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
        void load();
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
        void load();
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
        void load();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">All Users</h2>
          <p className="text-sm text-muted-foreground">
            {committedSearch
              ? `${total} result${total !== 1 ? 's' : ''} for "${committedSearch}"`
              : `${total} total user${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or UUID — press Enter to search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="pl-9"
        />
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {committedSearch ? 'No users match your search.' : 'No users found.'}
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const currentRole = getUserRole(u.roles);
            const isSelf = u.id === currentUser?.id;

            return (
              <div key={u.id} className="border rounded p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm flex-1">
                  <div className="font-medium text-base mb-1 flex items-center gap-2">
                    {u.display_name ?? u.id}
                    {isSelf && (
                      <Badge className="bg-green-500 hover:bg-green-500 text-white text-xs px-1.5 py-0">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <span>Current role:</span>
                    <Badge variant={getRoleBadgeVariant(currentRole)}>
                      {currentRole}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  {currentRole === 'user' && (
                    <Button size="sm" variant="outline" onClick={() => handleUpgradeToContributor(u.id)}>
                      Make Contributor
                    </Button>
                  )}
                  {currentRole === 'contributor' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleUpgradeToAdmin(u.id)}>
                        Upgrade to Admin
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleDowngradeToUser(u.id)}>
                        Downgrade to User
                      </Button>
                    </>
                  )}
                  {currentRole === 'admin' && (
                    <Button size="sm" variant="secondary" onClick={() => handleDowngradeToContributor(u.id)}>
                      Downgrade to Contributor
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages || loading}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
