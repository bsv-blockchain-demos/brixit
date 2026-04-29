import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchAllUsers,
  upgradeToContributor,
  upgradeToAdmin,
  downgradeToUser,
  type UserWithRoles,
} from '@/lib/adminApi';
import AdminUserDetail from './AdminUserDetail';

const PAGE_SIZE = 20;
const QUERY_KEY = 'admin-users';

export default function AdminUserManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [QUERY_KEY, committedSearch, page],
    queryFn: () => fetchAllUsers({
      search: committedSearch || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });

  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
      setCommittedSearch(search);
    }
  };

  const handleRoleAction = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string
  ) => {
    try {
      const res = await action();
      if (res.success) {
        toast({ title: successMsg });
        invalidate();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const getUserRole = (roles: string[] | null | undefined): 'user' | 'contributor' | 'admin' => {
    if (!roles?.length) return 'user';
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('contributor')) return 'contributor';
    return 'user';
  };

  if (selectedUserId) {
    return <AdminUserDetail userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default' as const;
      case 'contributor': return 'secondary' as const;
      default: return 'outline' as const;
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
        <Button variant="ghost" onClick={invalidate} disabled={isFetching} className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {committedSearch ? 'No users match your search.' : 'No users found.'}
        </p>
      ) : (
        <div className={`space-y-2 ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}>
          {users.map((u) => {
            const currentRole = getUserRole(u.roles);
            const isSelf = u.id === currentUser?.id;

            return (
              <div
                key={u.id}
                className="border rounded p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card text-card-foreground cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setSelectedUserId(u.id)}
              >
                <div className="text-sm flex-1">
                  <div className="font-medium text-base mb-1 flex items-center gap-2">
                    {u.display_name ?? u.id}
                    {isSelf && (
                      <Badge className="bg-action-primary hover:bg-action-primary text-white text-xs px-1.5 py-0">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <span>Current role:</span>
                    <Badge variant={getRoleBadgeVariant(currentRole)}>{currentRole}</Badge>
                    {u.submission_count != null && (
                      <span className="text-xs">{u.submission_count} submissions</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {currentRole === 'user' && (
                    <Button size="sm"
                      onClick={() => handleRoleAction(() => upgradeToContributor(u.id), 'User upgraded to contributor')}
                    >
                      Make Contributor
                    </Button>
                  )}
                  {currentRole === 'contributor' && (
                    <>
                      <Button size="sm"
                        onClick={() => handleRoleAction(() => upgradeToAdmin(u.id), 'User upgraded to admin')}
                      >
                        Upgrade to Admin
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => handleRoleAction(() => downgradeToUser(u.id), 'User downgraded to user')}
                      >
                        Downgrade to User
                      </Button>
                    </>
                  )}
                  {currentRole === 'admin' && !isSelf && (
                    <span className="text-xs text-muted-foreground italic">Admin — manage via DB</span>
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
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1 || isFetching}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages || isFetching}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
