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
    <div>
      {/* The relative/absolute pairing is scoped to just the title row, not the
          whole block: centering the button against the title+subtitle block as a
          unit put it at the wrapper's vertical midpoint, which lands inside the
          subtitle once that text wraps to 2 lines on narrow screens. */}
      <div className="text-center mb-6">
        <div className="relative">
          <h1 className="text-2xl font-display font-bold text-on-bg-text">All Readings</h1>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={isRefreshing ? 'Refreshing readings' : 'Refresh readings'}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <p className="mt-1 text-on-bg-body">Browse community readings across crops and places</p>
      </div>

      {/* One continuous panel on all sizes: filters, context and results merged
          into a single card, regions split by hairline dividers (no gaps). */}
      <div className="bg-card text-card-foreground border border-hairline rounded-2xl shadow-sm overflow-hidden">
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
