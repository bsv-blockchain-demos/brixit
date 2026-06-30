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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useFormattedSubmissionsCountQuery,
  useFormattedSubmissionsPageQuery,
  useFormattedSubmissionByIdQuery,
} from '../../hooks/useSubmissions';
import { useFilters, DEFAULT_MAP_FILTERS } from '../../contexts/FilterContext';
import { getFilterSummary, getActiveFilterList } from '../../lib/filterUtils';
import { fetchFormattedSubmissionsPage, type PublicFormattedSubmissionsQuery } from '../../lib/fetchSubmissions';
import { BrixDataPoint } from '../../types';
import SubmissionTableRow from '../common/SubmissionTableRow';
import { ColumnHint, ScoreHint, BRIX_HELP } from '../common/StatusBadges';
import MobileSubmissionCard from '../common/MobileSubmissionCard';
import DataPointDetailModal from '../common/DataPointDetailModal';
import { useAuth } from '../../contexts/AuthContext';

interface DataBrowserResultsProps {
  fromLeaderboard: boolean;
  onBackToLeaderboard: () => void;
}

const DataBrowserResultsImpl: React.FC<DataBrowserResultsProps> = ({
  fromLeaderboard,
  onBackToLeaderboard,
}) => {
  const { filters, isAdmin, setFilteredCount, setFilters } = useFilters();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const highlightedSubmissionId = (location.state as any)?.highlightedSubmissionId as string | undefined;

  const [itemsPerPage, setItemsPerPage] = useState(50);
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
      sortBy: serverSortBy,
      sortOrder,
    } satisfies Omit<PublicFormattedSubmissionsQuery, 'limit' | 'offset'>;
  }, [filters, sortBy, sortOrder]);

  const submissionsCountQuery = useFormattedSubmissionsCountQuery(countQuery);
  const totalCount = submissionsCountQuery.data ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const chunkIndex = Math.floor(((currentPage - 1) * itemsPerPage) / chunkSize);
  const chunkOffset = chunkIndex * chunkSize;
  const inChunkStart = ((currentPage - 1) * itemsPerPage) - chunkOffset;

  const pageQuery = useMemo(
    () => ({ ...countQuery, limit: chunkSize, offset: chunkOffset }),
    [countQuery, chunkOffset],
  );

  const submissionsPageQuery = useFormattedSubmissionsPageQuery(pageQuery);
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
      queryKey: ['submissions', 'public_formatted', 'page', nextPageQuery],
      queryFn: () => fetchFormattedSubmissionsPage(nextPageQuery),
      staleTime: 60 * 60 * 1000,
    });
  }, [nextPageQuery, queryClient, shouldPrefetchNextChunk]);

  // Reset to page 1 whenever filters or sort change.
  useEffect(() => { setCurrentPage(1); }, [filters, sortBy, sortOrder]);

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

  const handleOpenModal = useCallback((dp: BrixDataPoint) => {
    setSelectedDataPoint(dp);
    setIsModalOpen(true);
  }, []);

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
  const clearAllFilters = useCallback(() => setFilters(DEFAULT_MAP_FILTERS), [setFilters]);

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
      {filterSummary !== 'No active filters' && (
        <p className="text-sm text-text-mid p-4 border-b border-hairline lb-desktop-only">
          Applying filters: <span className="font-semibold text-text-dark">{filterSummary}</span>
        </p>
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
      <Card className="border-0 shadow-none rounded-none bg-transparent">
        <CardHeader className="px-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{totalCount} {totalCount === 1 ? 'Result' : 'Results'}</CardTitle>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
            >
              <SelectTrigger className="h-8 w-[120px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>Show {n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
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
                    Location {sortBy === 'locationName' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                  <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider">
                    <ColumnHint help="Whether this reading is approved for public display. Most are approved automatically; outliers are reviewed by an admin.">Verified</ColumnHint>
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider">
                    <ColumnHint help="Whether this reading is anchored to the BSV blockchain. 'Timestamped' means it has been anchored, giving a permanent, tamper-evident record; 'Pending' means anchoring is still in progress.">Blockchain</ColumnHint>
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-brown uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-text-mid">
                      No data found for the current filters.
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
              <p className="text-center py-8 text-text-mid">No data found for the current filters.</p>
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
