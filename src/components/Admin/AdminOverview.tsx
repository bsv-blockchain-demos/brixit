import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ClipboardList, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchAllUsers, fetchUnverifiedSubmissions, type UserWithRoles } from '@/lib/adminApi';
import { apiGet } from '@/lib/api';

async function fetchOverviewStats() {
  const [usersResult, pendingResult, countData] = await Promise.all([
    fetchAllUsers({ limit: 100, offset: 0 }),
    fetchUnverifiedSubmissions({ limit: 1, offset: 0 }),
    apiGet<{ count: number }>('/api/submissions/count', { skipAuth: true }),
  ]);

  const adminCount = usersResult.data.filter((u: UserWithRoles) => u.roles?.includes('admin')).length;
  const contributorCount = usersResult.data.filter(
    (u: UserWithRoles) => u.roles?.includes('contributor') && !u.roles?.includes('admin')
  ).length;

  return {
    totalUsers: usersResult.total,
    adminCount,
    contributorCount,
    totalSubmissions: countData.count,
    pendingVerifications: pendingResult.total,
  };
}

export default function AdminOverview() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: fetchOverviewStats,
    staleTime: Infinity,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">Live snapshot of platform data</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{(error as any)?.message ?? 'Failed to load stats'}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? '—' : stats?.totalUsers}</div>
            {stats && (
              <div className="flex gap-2 mt-2">
                <Badge variant="default" className="text-xs">
                  {stats.adminCount} admin{stats.adminCount !== 1 ? 's' : ''}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {stats.contributorCount} contributor{stats.contributorCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? '—' : stats?.totalSubmissions}</div>
            <p className="text-xs text-muted-foreground mt-2">Verified &amp; publicly visible</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            {stats?.pendingVerifications ? (
              <AlertCircle className="w-4 h-4 text-gold" />
            ) : (
              <CheckCircle className="w-4 h-4 text-action-primary" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? '—' : stats?.pendingVerifications}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.pendingVerifications
                ? 'Submissions awaiting verification'
                : 'All submissions verified'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
