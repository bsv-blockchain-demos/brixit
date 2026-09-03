/**
 * Table + pagination + filter summary for the data browser.
 *
 * Owns: pagination, sort, modal state, queries. Memo'd so the filter card's
 * UI tweaks don't re-render the rows.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { TableSortControl, type SortOption } from '@/components/common/TableSortControl';
import { ChevronLeft, ChevronRight, SearchX, X } from 'lucide-react';
import {
  useFormattedSubmissionsCountQuery,
  useFormattedSubmissionsPageQuery,
  useFormattedSubmissionByIdQuery,
} from '../../hooks/useSubmissions';
import { useFilters, DEFAULT_MAP_FILTERS } from '../../contexts/FilterContext';
import { getFilterSummary, getActiveFilterList, getRemovableFilters } from '../../lib/filterUtils';
import { fetchFormattedSubmissionsPage, fetchMineFormattedSubmissionsPage, type PublicFormattedSubmissionsQuery } from '../../lib/fetchSubmissions';
import { BrixDataPoint } from '../../types';
import SubmissionTableRow from '../common/SubmissionTableRow';
import { ColumnHint, ScoreHint, BRIX_HELP } from '../common/StatusBadges';
import MobileSubmissionCard from '../common/MobileSubmissionCard';
import DataPointDetailModal from '../common/DataPointDetailModal';
import RejectedSubmissions from '../YourData/RejectedSubmissions';
import { useAuth } from '../../contexts/AuthContext';
import { useRetryAnchor } from '@/hooks/useRetryAnchor';
import { useMaxWidth } from '@/hooks/use-mobile';

interface DataBrowserResultsProps {
  fromLeaderboard: boolean;
  onBackToLeaderboard: () => void;
}

// Condition inlined on purpose; see the note in useSubmissions.ts.
// Mirrors the sortable column headers in the desktop table below.
type MobileSortKey = 'submittedAt' | 'cropType' | 'locationName' | 'brixLevel';
const MOBILE_SORT_OPTIONS: SortOption<MobileSortKey>[] = [
  { value: 'submittedAt', label: 'Date' },
  { value: 'cropType', label: 'Crop' },
  { value: 'locationName', label: 'Place' },
  { value: 'brixLevel', label: 'BRIX' },
];

const DataBrowserResultsImpl: React.FC<DataBrowserResultsProps> = ({
  fromLeaderboard,
  onBackToLeaderboard,
}) => {
  const { filters, isAdmin, setFilteredCount, setFilters, scope } = useFilters();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const highlightedSubmissionId = (location.state as any)?.highlightedSubmissionId as string | undefined;

  const { retryAnchor, retryingId } = useRetryAnchor();

  // Fixed page size: the next chunk is prefetched, so a picker bought little.
  const itemsPerPage = 50;
  const chunkSize = itemsPerPage;
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<keyof BrixDataPoint>('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const countQuery = useMemo(() => {
    const serverSortBy: NonNullable<PublicFormattedSubmissionsQuery['sortBy']> =
      sortBy === 'submittedAt' ? 'assessment_date'
      : sortBy === 'brixLevel' ? 'brix_value'
      : sortBy === 'cropType' ? 'crop_name'
      : sortBy === 'locationName' ? 'place_label'
      : 'assessment_date';

    const hasCustomBrixRange =
      filters.brixRange?.[0] !== DEFAULT_MAP_FILTERS.brixRange[0] ||
      filters.brixRange?.[1] !== DEFAULT_MAP_FILTERS.brixRange[1];

    return {
      cropTypes: filters.cropTypes.length > 0 ? filters.cropTypes : undefined,
      category: filters.category || undefined,
      brand: filters.brand || undefined,
      place: filters.place || undefined,
      location: filters.location || undefined,
      city: filters.city || undefined,
      state: filters.state || undefined,
      country: filters.country || undefined,
      brixMin: hasCustomBrixRange ? filters.brixRange?.[0] : undefined,
      brixMax: hasCustomBrixRange ? filters.brixRange?.[1] : undefined,
      dateStart: filters.dateRange?.[0] || undefined,
      dateEnd: filters.dateRange?.[1] || undefined,
      search: filters.search || undefined,
      timestamped: filters.timestamped || undefined,
      // Rejected readings live in the flagged section above, so they are kept
      // out of the list here and out of the count that pages it. Only the
      // authenticated /mine routes understand the parameter; the public ones
      // never return rejected rows anyway.
      ...(scope === 'mine' ? { rejected: false } : {}),
      sortBy: serverSortBy,
      sortOrder,
    } satisfies Omit<PublicFormattedSubmissionsQuery, 'limit' | 'offset'>;
  }, [filters, sortBy, sortOrder, scope]);

  const submissionsCountQuery = useFormattedSubmissionsCountQuery(countQuery, scope);
  const totalCount = submissionsCountQuery.data ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const chunkIndex = Math.floor(((currentPage - 1) * itemsPerPage) / chunkSize);
  const chunkOffset = chunkIndex * chunkSize;
  const inChunkStart = ((currentPage - 1) * itemsPerPage) - chunkOffset;

  const pageQuery = useMemo(
    () => ({ ...countQuery, limit: chunkSize, offset: chunkOffset }),
    [countQuery, chunkOffset],
  );

  const submissionsPageQuery = useFormattedSubmissionsPageQuery(pageQuery, scope);
  const chunkData = submissionsPageQuery.data ?? [];

  const shouldPrefetchNextChunk =
    totalCount > 0 &&
    (currentPage * itemsPerPage) % chunkSize === 0 &&
    chunkOffset + chunkSize < totalCount;

  const nextPageQuery = useMemo(
    () => ({ ...countQuery, limit: chunkSize, offset: chunkOffset + chunkSize }),
    [countQuery, chunkOffset],
  );

  useEffect(() => {
    if (!shouldPrefetchNextChunk) return;
    queryClient.prefetchQuery({
      queryKey: ['submissions', 'public_formatted', 'page', scope, nextPageQuery],
      // Must mirror the hook's mock branch. This writes into the same cache
      // key the hook reads, so calling the real fetch here would hand the
      // next page real (or failed) data while page 1 shows mock rows.
      queryFn: () =>
        import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_DATA === '1'
          ? import('@/lib/devMockData').then((m) => m.mockSubmissionsPage(nextPageQuery, scope))
          : scope === 'mine'
            ? fetchMineFormattedSubmissionsPage(nextPageQuery)
            : fetchFormattedSubmissionsPage(nextPageQuery),
      staleTime: 60 * 60 * 1000,
    });
  }, [nextPageQuery, queryClient, shouldPrefetchNextChunk, scope]);

  // Reset to page 1 whenever filters or sort change.
  useEffect(() => { setCurrentPage(1); }, [filters, sortBy, sortOrder, scope]);

  useEffect(() => { setFilteredCount(totalCount); }, [setFilteredCount, totalCount]);

  const currentItems = useMemo(
    () => chunkData.slice(inChunkStart, inChunkStart + itemsPerPage),
    [chunkData, inChunkStart],
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDataPoint, setSelectedDataPoint] = useState<BrixDataPoint | null>(null);

  // Pre-fetched submission when arriving via highlighted link from /map.
  const highlightedQuery = useFormattedSubmissionByIdQuery(highlightedSubmissionId, {
    enabled: !!highlightedSubmissionId,
  });
  const highlightedOpenedRef = useRef(false);
  useEffect(() => {
    if (highlightedQuery.data && !highlightedOpenedRef.current) {
      highlightedOpenedRef.current = true;
      setSelectedDataPoint(highlightedQuery.data);
      setIsModalOpen(true);
      window.history.replaceState({}, '');
    }
  }, [highlightedQuery.data]);

  // Desktop opens the reading at its own address, so it can be linked and the
  // back button works. Narrow screens keep the sheet, which leaves the list in
  // place behind it.
  const isNarrow = useMaxWidth(640);
  const handleOpenModal = useCallback((dp: BrixDataPoint) => {
    if (!isNarrow) {
      navigate(`/readings/${dp.id}${scope === 'mine' ? '?scope=mine' : ''}`);
      return;
    }
    setSelectedDataPoint(dp);
    setIsModalOpen(true);
  }, [isNarrow, navigate, scope]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedDataPoint(null);
  }, []);

  const handleUpdateSuccess = useCallback((updated: BrixDataPoint) => {
    queryClient.invalidateQueries({ queryKey: ['submissions'] });
    setSelectedDataPoint(updated);
  }, [queryClient]);

  const handleDeleteSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['submissions'] });
    handleCloseModal();
  }, [queryClient, handleCloseModal]);

  const handleSort = (column: keyof BrixDataPoint) => {
    if (sortBy === column) setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(column); setSortOrder('desc'); }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const filterSummary = getFilterSummary(filters, isAdmin);
  const activeFilterChips = getActiveFilterList(filters, isAdmin);
  const removableFilters = getRemovableFilters(filters, isAdmin);
  const clearAllFilters = useCallback(() => setFilters(DEFAULT_MAP_FILTERS), [setFilters]);

  // Two different situations were both reported as "No data found for the
  // current filters": a filter combination that matches nothing, and a
  // genuinely empty dataset. Only the first has an action worth offering, and
  // saying "for the current filters" when none are set is just wrong.
  // getActiveFilterList does not account for the free-text search, so a
  // search-only query would otherwise report no active filters and show the
  // "nothing here yet" copy while the user is staring at their own query.
  const hasNarrowedResults = activeFilterChips.length > 0 || !!filters.search;

  const emptyState = (
    <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
      <SearchX className="h-8 w-8 text-text-muted-brown" aria-hidden="true" />
      {hasNarrowedResults ? (
        <>
          <p className="text-text-dark font-medium">No readings match these filters</p>
          <p className="text-sm text-text-mid max-w-sm">
            Try widening the BRIX range or removing a filter to see more of the community's readings.
          </p>
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Clear all filters
          </Button>
        </>
      ) : (
        <>
          <p className="text-text-dark font-medium">
            {scope === 'mine' ? 'You have no readings yet' : 'No readings yet'}
          </p>
          <p className="text-sm text-text-mid max-w-sm">
            {scope === 'mine'
              ? 'Readings you submit will show up here.'
              : 'Readings submitted by the community will show up here.'}
          </p>
          {(user?.role === 'contributor' || user?.role === 'admin') && (
            <Button size="sm" onClick={() => navigate('/data-entry')}>
              {scope === 'mine' ? 'Add your first reading' : 'Add the first reading'}
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop banner — unchanged; hidden ≤640px (mobile uses the merged card region below) */}
      {fromLeaderboard && (
        <div className="lb-desktop-only p-3 bg-surface-canvas border-b border-hairline">
          <div className="flex items-center justify-between">
            <p className="text-text-dark text-sm">Showing filtered results from leaderboard selection</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToLeaderboard}
              className="text-green-fresh hover:text-green-mid"
            >
              ← Back to Leaderboard
            </Button>
          </div>
        </div>
      )}

      {/* Summary is styled for the steel background, so it's desktop-only; on mobile
          the Filters button's count badge conveys active filters instead. */}
      {removableFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-hairline lb-desktop-only">
          <span className="text-sm text-text-mid">Applying filters:</span>
          {removableFilters.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-canvas pl-3 pr-1 py-0.5 text-sm text-text-dark"
            >
              {f.label}
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, ...f.reset }))}
                aria-label={`Remove filter ${f.label}`}
                className="rounded-full p-0.5 text-text-muted-brown hover:text-text-dark hover:bg-hairline transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm font-medium text-action-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Mobile filter-context region (≤640px) — flat, hairline-divided from results.
          The enclosing panel is provided by DataTable (merges filters + results). */}
      <>
        {fromLeaderboard && (
          <div className="lb-mobile-only p-3.5 border-b border-hairline">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted-brown">From Leaderboard</span>
              {activeFilterChips.length > 0 && (
                <button onClick={clearAllFilters} className="text-sm font-medium text-action-primary">Clear all</button>
              )}
            </div>
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {activeFilterChips.map((chip, i) => (
                  <span key={`${chip}-${i}`} className="inline-block max-w-full break-words rounded-full bg-accent text-accent-foreground text-xs px-2.5 py-1">{chip}</span>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-hairline">
              <button onClick={onBackToLeaderboard} className="flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-blue-mid hover:text-blue-deep">
                <span aria-hidden>←</span> Back to Leaderboard
              </button>
            </div>
          </div>
        )}
      {scope === 'mine' && user?.id && (
        <div className="px-3 sm:px-6 pt-4">
          <RejectedSubmissions userId={user.id} />
        </div>
      )}
      <Card className="border-0 shadow-none rounded-none bg-transparent">
        <CardHeader className="px-3 sm:px-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>{totalCount} {totalCount === 1 ? 'Result' : 'Results'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {/* Sorting on mobile: the column headers below are inside a
              `hidden desktop:block` wrapper, so this is the only way to reach
              the same sortBy/sortOrder state on a narrow viewport. Changing
              either resets to page 1 via the effect that watches them. */}
          <TableSortControl
            className="desktop:hidden mb-3"
            options={MOBILE_SORT_OPTIONS}
            sortBy={sortBy as MobileSortKey}
            sortOrder={sortOrder}
            onSortByChange={(v) => setSortBy(v)}
            onSortOrderToggle={() => setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
          />

          {/* Desktop table */}
          <div className="hidden desktop:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-hairline">
                  <TableHead
                    className="text-xs text-text-muted-brown uppercase tracking-wider whitespace-nowrap cursor-pointer"
                    onClick={() => handleSort('submittedAt')}
                  >
                    Date {sortBy === 'submittedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead
                    className="text-xs text-text-muted-brown uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('cropType')}
                  >
                    Crop {sortBy === 'cropType' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  {/* <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider">
                    Variety
                  </TableHead> */}
                  <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider">Brand</TableHead>
                  <TableHead
                    className="text-xs text-text-muted-brown uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('locationName')}
                  >
                    Place {sortBy === 'locationName' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead
                    className="text-xs text-text-muted-brown uppercase tracking-wider text-center cursor-pointer"
                    onClick={() => handleSort('brixLevel')}
                  >
                    <ColumnHint help={BRIX_HELP}>BRIX</ColumnHint> {sortBy === 'brixLevel' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider text-center">
                    <ScoreHint variant="rating">Score</ScoreHint>
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider">Notes</TableHead>
                  {/* Approval state: the badge is icon-only now, so the label
                      is dropped and the explanation lives in its popover. */}
                  <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider">
                    <span className="sr-only">Approval</span>
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider">
                    <ColumnHint help="Whether this reading is anchored to the BSV blockchain. A checkmark means it has been anchored, giving a permanent, tamper-evident record; a clock means anchoring is still in progress.">Status</ColumnHint>
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="p-0">
                      {emptyState}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentItems.map((submission) => {
                    const isOwner = user?.id === submission.userId;
                    const canDeleteByOwner = (isOwner && !submission.verified) || isAdmin;
                    return (
                      <SubmissionTableRow
                        key={submission.id}
                        submission={submission}
                        onDelete={() => handleOpenModal(submission)}
                        isOwner={isOwner}
                        canDeleteByOwner={canDeleteByOwner}
                        onOpenModal={handleOpenModal}
                        onEdit={isOwner ? () => handleOpenModal(submission) : undefined}
                        // Retry only makes sense on your own, not-yet-anchored rows.
                        onRetry={isOwner && !submission.outpoint ? () => retryAnchor(submission) : undefined}
                        isRetrying={retryingId === submission.id}
                        // In the Mine scope every row is yours, so the badge is noise.
                        showOwnerBadge={scope === 'all'}
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          <div className="desktop:hidden space-y-3">
            {currentItems.length === 0 ? (
              emptyState
            ) : (
              currentItems.map((submission) => (
                <MobileSubmissionCard
                  key={submission.id}
                  submission={submission}
                  isOwner={user?.id === submission.userId}
                  onOpenModal={() => handleOpenModal(submission)}
                />
              ))
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-hairline">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="border-hairline hover:bg-surface-canvas gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="border-hairline hover:bg-surface-canvas gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
      </>

      <DataPointDetailModal
        dataPoint={selectedDataPoint}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onDeleteSuccess={handleDeleteSuccess}
        onUpdateSuccess={handleUpdateSuccess}
      />
    </>
  );
};

const DataBrowserResults = memo(DataBrowserResultsImpl);
export default DataBrowserResults;
