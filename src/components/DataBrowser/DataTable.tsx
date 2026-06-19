/**
 * Page orchestrator — header, URL-filter bootstrap, and the two children.
 * Children own their own state so the table doesn't re-render on filter twiddles.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { RefreshCw } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import { parseURLSearchParams, mergeFiltersWithDefaults } from '../../lib/urlFilterUtils';
import DataBrowserFilters from './DataBrowserFilters';
import DataBrowserResults from './DataBrowserResults';

const REFRESH_COOLDOWN_S = 15;

const DataTable: React.FC = () => {
  const { setFilters } = useFilters();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = useCallback(() => {
    if (cooldownSeconds > 0) return;
    queryClient.invalidateQueries({ queryKey: ['submissions'] });
    setCooldownSeconds(REFRESH_COOLDOWN_S);
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [queryClient, cooldownSeconds]);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

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
          disabled={cooldownSeconds > 0}
          className="flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          {cooldownSeconds > 0 ? `Refresh (${cooldownSeconds}s)` : 'Refresh'}
        </Button>
      </div>

      {/* Merge wrapper: one continuous panel ≤640px (filters · context · results);
          display:contents ≥641px so the desktop layout renders byte-for-byte as before. */}
      <div className="bg-surface-canvas text-card-foreground border border-blue-pale rounded-2xl overflow-hidden sm:contents">
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
