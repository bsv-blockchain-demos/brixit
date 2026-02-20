import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ClipboardList, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchAllUsers, fetchUnverifiedSubmissions, type UserWithRoles } from '@/lib/adminApi';
import { apiGet } from '@/lib/api';

interface Stats {
  totalUsers: number;
  adminCount: number;
  contributorCount: number;
  totalSubmissions: number;
  pendingVerifications: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, pending, countData] = await Promise.all([
        fetchAllUsers(),
        fetchUnverifiedSubmissions(),
        apiGet<{ count: number }>('/api/submissions/count', { skipAuth: true }),
      ]);

      const adminCount = users.filter((u: UserWithRoles) => u.roles?.includes('admin')).length;
      const contributorCount = users.filter((u: UserWithRoles) => u.roles?.includes('contributor') && !u.roles?.includes('admin')).length;

      setStats({
        totalUsers: users.length,
        adminCount,
        contributorCount,
        totalSubmissions: countData.count,
        pendingVerifications: pending.length,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">Live snapshot of platform data</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalUsers ?? '—'}</div>
            {stats && (
              <div className="flex gap-2 mt-2">
                <Badge variant="default" className="text-xs">{stats.adminCount} admin{stats.adminCount !== 1 ? 's' : ''}</Badge>
                <Badge variant="secondary" className="text-xs">{stats.contributorCount} contributor{stats.contributorCount !== 1 ? 's' : ''}</Badge>
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
            <div className="text-3xl font-bold">{stats?.totalSubmissions ?? '—'}</div>
            <p className="text-xs text-muted-foreground mt-2">Verified & publicly visible</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            {stats?.pendingVerifications ? (
              <AlertCircle className="w-4 h-4 text-yellow-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.pendingVerifications ?? '—'}</div>
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
