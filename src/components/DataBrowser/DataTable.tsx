/**
 * Page orchestrator — header, URL-filter bootstrap, and the two children.
 * Children own their own state so the table doesn't re-render on filter twiddles.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { RefreshCw } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import { parseURLSearchParams, mergeFiltersWithDefaults } from '../../lib/urlFilterUtils';
import DataBrowserFilters from './DataBrowserFilters';
import DataBrowserResults from './DataBrowserResults';

const DataTable: React.FC = () => {
  const { setFilters } = useFilters();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Disable refresh only while a submissions fetch is in flight (no fixed cooldown).
  const isRefreshing = useIsFetching({ queryKey: ['submissions'] }) > 0;

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    queryClient.invalidateQueries({ queryKey: ['submissions'] });
  }, [queryClient, isRefreshing]);

  // Apply URL search params to filters once on mount (e.g. from leaderboard).
  const [urlFiltersApplied, setUrlFiltersApplied] = useState(false);
  const [fromLeaderboard, setFromLeaderboard] = useState(false);
  useEffect(() => {
    if (urlFiltersApplied || !searchParams.toString()) return;
    const urlFilters = parseURLSearchParams(searchParams);
    if (Object.keys(urlFilters).length === 0) return;
    setFilters(mergeFiltersWithDefaults(urlFilters));
    setUrlFiltersApplied(true);
    setFromLeaderboard(true);
  }, [searchParams, urlFiltersApplied, setFilters]);

  const handleBackToLeaderboard = useCallback(() => {
    setFromLeaderboard(false);
    navigate('/leaderboard');
  }, [navigate]);

  return (
    <div className="px-0 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">All Submissions</h2>
          <p className="text-on-bg-body mt-1">Browse community measurements across crops and locations</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>

      {/* Merge wrapper: one continuous panel ≤640px (filters · context · results);
          display:contents ≥641px so the desktop layout renders byte-for-byte as before. */}
      <div className="bg-surface-canvas text-card-foreground border border-hairline rounded-2xl overflow-hidden sm:contents">
        <DataBrowserFilters fromLeaderboard={fromLeaderboard} />
        <DataBrowserResults
          fromLeaderboard={fromLeaderboard}
          onBackToLeaderboard={handleBackToLeaderboard}
        />
      </div>
    </div>
  );
};

export default DataTable;
