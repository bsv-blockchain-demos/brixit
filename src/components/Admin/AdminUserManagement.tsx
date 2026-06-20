import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Copy, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchAllUsers,
  upgradeToContributor,
  upgradeToAdmin,
  downgradeToUser,
} from '@/lib/adminApi';
import AdminUserDetail from './AdminUserDetail';

const PAGE_SIZE = 20;
const QUERY_KEY = 'admin-users';

const short = (k: string) => `${k.slice(0, 8)}…${k.slice(-6)}`;

function RoleChip({ role }: { role: 'user' | 'contributor' | 'admin' }) {
  if (role === 'admin') {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-select-bg text-select-fg capitalize">admin</span>;
  }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-canvas text-text-mid border border-hairline capitalize">
      {role}
    </span>
  );
}

export default function AdminUserManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyKey = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
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

  // Neutral / steel role-change buttons (role changes are not the page's single CTA)
  const steelBtn = "min-h-[40px] px-3 rounded-lg text-sm font-medium bg-select-bg text-select-fg border border-select-border/40 hover:brightness-95";
  const ghostBtn = "min-h-[40px] px-3 rounded-lg text-sm font-medium border border-hairline text-text-dark hover:bg-surface-canvas";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-text-dark">All Users</h2>
          <p className="text-sm text-text-mid">
            {committedSearch
              ? `${total} result${total !== 1 ? 's' : ''} for "${committedSearch}"`
              : `${total} total user${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={invalidate}
          disabled={isFetching}
          aria-label="Refresh users"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-mid hover:text-text-dark hover:bg-surface-canvas disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <Input
          placeholder="Search by name or UUID — press Enter to search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-text-mid">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-text-mid">
          {committedSearch ? 'No users match your search.' : 'No users found.'}
        </p>
      ) : (
        <div className={`bg-card border border-hairline rounded-2xl shadow-sm overflow-hidden divide-y divide-hairline ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}>
          {users.map((u) => {
            const currentRole = getUserRole(u.roles);
            const isSelf = u.id === currentUser?.id;

            return (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-surface-canvas transition-colors cursor-pointer"
                onClick={() => setSelectedUserId(u.id)}
              >
                {/* Identity */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-blue-deep text-white text-sm">
                      {(u.display_name ?? 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium text-text-dark flex items-center gap-2">
                      <span className="truncate">{u.display_name ?? u.id}</span>
                      {isSelf && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-select-bg text-select-fg shrink-0">You</span>
                      )}
                    </div>
                    {u.identity_key ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); copyKey(u.identity_key!, u.id); }}
                        className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-text-muted hover:text-text-mid"
                        title="Copy wallet identity"
                      >
                        {short(u.identity_key)}
                        {copiedId === u.id ? <Check className="w-3 h-3 text-green-mid" /> : <Copy className="w-3 h-3" />}
                      </button>
                    ) : (
                      <span className="mt-0.5 block text-xs italic text-text-muted">no wallet identity</span>
                    )}
                  </div>
                </div>

                {/* Activity */}
                <div className="text-xs text-text-mid sm:w-28 sm:text-right shrink-0">
                  {u.submission_count != null ? `${u.submission_count} submission${u.submission_count !== 1 ? 's' : ''}` : '—'}
                </div>

                {/* Role */}
                <div className="sm:w-24 shrink-0">
                  <RoleChip role={currentRole} />
                </div>

                {/* Manage */}
                <div className="flex flex-col sm:flex-row gap-2 sm:w-auto" onClick={(e) => e.stopPropagation()}>
                  {currentRole === 'user' && (
                    <button className={`w-full sm:w-auto ${steelBtn}`}
                      onClick={() => handleRoleAction(() => upgradeToContributor(u.id), 'User upgraded to contributor')}
                    >
                      Make Contributor
                    </button>
                  )}
                  {currentRole === 'contributor' && (
                    <>
                      <button className={`w-full sm:w-auto ${steelBtn}`}
                        onClick={() => handleRoleAction(() => upgradeToAdmin(u.id), 'User upgraded to admin')}
                      >
                        Make admin
                      </button>
                      <button className={`w-full sm:w-auto ${ghostBtn}`}
                        onClick={() => handleRoleAction(() => downgradeToUser(u.id), 'User downgraded to user')}
                      >
                        Downgrade
                      </button>
                    </>
                  )}
                  {currentRole === 'admin' && !isSelf && (
                    <span className="text-xs text-text-muted italic">Managed via DB</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1 || isFetching}
            className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-hairline text-sm text-text-dark hover:bg-surface-canvas disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-text-mid">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages || isFetching}
            className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-hairline text-sm text-text-dark hover:bg-surface-canvas disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
