import React from "react";
import { ChevronDown, Loader2, MapPin, SearchX, Trophy } from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "../ui/card";
import { LeaderboardEntry } from "../../lib/fetchLeaderboards";
import { computeNormalizedScore } from "../../lib/getBrixColor";
import { ScoreGauge } from "../common/ScoreGauge";
import { ScoreHint, ColumnHint } from "../common/StatusBadges";
import { formatUsername } from "../../lib/formatUsername";
import { formatVenueLocation } from "../../lib/formatAddress";
import { RankLaurel } from "../common/RankLaurel";

interface LeaderboardCardProps {
  title: string;
  subtitle?: string;
  data: LeaderboardEntry[];
  labelKey: 'location' | 'brand' | 'user';
  loadMoreType: 'location' | 'brand' | 'user';
  hasMore: boolean;
  isFirstLoad: boolean;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  isFetching: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onNavigate: (entry: any, type: 'location' | 'brand' | 'user') => void;
}

/* Mobile-only card list (≤640px). Presentation only; the rank/tie/score
   derivation mirrors the desktop table so displayed values match exactly.
   Colors come from design tokens (Tailwind token classes, ScoreGauge); the
   laurel's medal tones are the documented exception. */
function LeaderboardMobileList({
  data,
  labelKey,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onNavigate,
}: Pick<LeaderboardCardProps, 'data' | 'labelKey' | 'hasMore' | 'isLoadingMore' | 'onLoadMore' | 'onNavigate'>) {
  const rankCounts = data.reduce((acc, entry) => {
    const r = entry.rank ?? 0;
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const clickable = labelKey !== 'user';

  return (
    <div>
      {data.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-muted-brown bg-table-header border-b border-hairline">
          <span className="shrink-0 w-[34px] text-center"><ColumnHint help="Where this entry places on the leaderboard. Entries that are tied share the same rank, shown as (tie).">Rank</ColumnHint></span>
          <span className="flex-1">{labelKey === 'location' ? 'Store' : 'Name'}</span>
          <span className="shrink-0">{labelKey === 'user' ? 'Readings' : <ScoreHint>Score</ScoreHint>}</span>
        </div>
      )}
      {data.map((entry, idx) => {
        const label =
          (entry as any)[`${labelKey}_label`] ||
          (entry as any)[`${labelKey}_name`] ||
          (entry as any).user_name ||
          (entry as any).display_name ||
          (entry as any).entity_name ||
          'Unknown';

        const score = entry.average_normalized_score ?? null;
        const normalizedScore =
          typeof score === 'number'
            ? score
            : typeof entry.average_brix === 'number'
              ? computeNormalizedScore(entry.average_brix)
              : 1.5;

        const rank = entry.rank ?? idx + 1;
        const isTie = rankCounts[rank] > 1;
        const subs = entry.submission_count ?? 0;
        const name = labelKey === 'user' ? formatUsername(label) : label;
        const locationLine =
          labelKey === 'location'
            ? formatVenueLocation((entry as any).street_address, (entry as any).city, (entry as any).state)
            : '';

        return (
          <div
            key={(entry as any)[`${labelKey}_id`] ?? label ?? idx}
            onClick={clickable ? () => onNavigate(entry, labelKey) : undefined}
            className={`flex items-center gap-4 px-4 py-3 border-b border-hairline last:border-b-0 ${
              clickable ? 'cursor-pointer' : ''
            }`}
          >
            {/* Left: rank medal (+ tie label) */}
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <RankLaurel rank={rank} />
              {isTie && <span className="text-[10px] leading-none text-text-muted-brown">(tie)</span>}
            </div>

            {/* Center: name / location / submissions */}
            <div className="flex-1 min-w-0">
              <div className="text-[15.5px] font-semibold text-text-dark line-clamp-2">{name}</div>
              {labelKey === 'location' && locationLine && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-text-muted-brown">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{locationLine}</span>
                </div>
              )}
              <div className="mt-0.5 text-xs text-text-muted-brown">{subs} readings</div>
            </div>

            {/* Right: score badge (boards) or submission count (user board) */}
            <div className="shrink-0">
              {labelKey === 'user' ? (
                <span className="font-display font-bold text-base text-text-dark">{subs}</span>
              ) : (
                <ScoreGauge normalizedScore={normalizedScore} />
              )}
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="w-full flex items-center justify-center gap-2 text-sm text-green-fresh hover:text-green-mid disabled:text-text-muted-brown py-1"
        >
          <span>{isLoadingMore ? 'Loading…' : 'Load more'}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}


/**
 * Desktop tracks. The place and brand boards get two extra columns: the
 * reading count, which says how much evidence the rating rests on, and the
 * mean BRIX behind it. The contributor board already ranks by count, so
 * adding it again would just repeat the last column.
 */
const COLS_WITH_DETAIL = 'grid-cols-[3.5rem_1fr_6rem_6rem_5.5rem]';
const COLS_PLAIN = 'grid-cols-[3.5rem_1fr_5.5rem]';

export function LeaderboardCard({
  title,
  subtitle,
  data,
  labelKey,
  hasMore,
  isFirstLoad,
  isFetching,
  isLoadingMore,
  onLoadMore,
  onNavigate,
  hasActiveFilters = false,
  onResetFilters,
}: LeaderboardCardProps) {
  // Names what this specific board ranks, so three empty cards do not all read
  // the same. Nothing here is a real error: it is either still loading, too
  // narrow a filter, or genuinely no readings yet.
  // Contributors are ranked by reading count already, so the detail columns
  // would restate the last column.
  const showDetailColumns = labelKey !== 'user';
  const DESKTOP_COLS = showDetailColumns ? COLS_WITH_DETAIL : COLS_PLAIN;

  const noun =
    labelKey === 'location' ? 'places'
    : labelKey === 'brand' ? 'brands'
    : 'contributors';

  return (
    <div className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold font-display text-text-dark text-center">{title}</CardTitle>
        {subtitle && (
          <p className="text-sm text-text-mid text-center mt-1">{subtitle}</p>
        )}
        {labelKey === "user" && (
          <p className="text-sm text-muted-foreground text-center mt-1">
            Global rankings • All users
          </p>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className={isFirstLoad || isFetching ? 'opacity-50 pointer-events-none' : ''}>
          {data.length === 0 ? (
            // "No data available" is only true once loading has finished.
            // While the first load is in flight the board is empty because
            // nothing has arrived yet, so say that instead.
            <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center text-sm text-text-muted-brown">
              {isFirstLoad ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>Loading...</span>
                </>
              ) : hasActiveFilters ? (
                <>
                  <SearchX className="h-6 w-6" aria-hidden="true" />
                  <span className="font-medium text-text-dark">No {noun} match these filters</span>
                  <span className="max-w-xs">Widen the area or clear the crop and place filters to see more.</span>
                  {onResetFilters && (
                    <button
                      onClick={onResetFilters}
                      className="mt-1 text-sm font-medium text-action-primary hover:underline"
                    >
                      Reset filters
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Trophy className="h-6 w-6" aria-hidden="true" />
                  <span className="font-medium text-text-dark">No {noun} ranked yet</span>
                  <span className="max-w-xs">
                    Rankings appear once the community has submitted enough readings here.
                  </span>
                </>
              )}
            </div>
          ) : (
            <>
            <div className="lb-desktop-only">
              <div className={`grid ${DESKTOP_COLS} gap-x-6 text-xs font-medium text-text-muted-brown uppercase tracking-wider border-b border-hairline px-4 py-2 bg-table-header`}>
                <span className="text-center"><ColumnHint help="Where this entry places on the leaderboard. Entries that are tied share the same rank, shown as (tie).">Rank</ColumnHint></span>
                <span className="text-left">
                  {labelKey === "location" ? "Store" : "Name"}
                </span>
                {showDetailColumns && (
                  <>
                    <span className="text-center">
                      <ColumnHint help="How many readings this average is based on. A high score from two readings is weaker evidence than the same score from fifty.">Readings</ColumnHint>
                    </span>
                    <span className="text-center">
                      <ColumnHint help="The mean raw refractometer value across those readings. Not comparable across crops on its own, which is what the rating is for.">Avg BRIX</ColumnHint>
                    </span>
                  </>
                )}
                <span className="text-center">
                  {labelKey === "user" ? "Readings" : <ScoreHint>Score</ScoreHint>}
                </span>
              </div>

              <div>
                {(() => {
                  const rankCounts = data.reduce((acc, entry) => {
                    const r = entry.rank ?? 0;
                    acc[r] = (acc[r] || 0) + 1;
                    return acc;
                  }, {} as Record<number, number>);

                  return data.map((entry, idx) => {
                    const label =
                      (entry as any)[`${labelKey}_label`] ||
                      (entry as any)[`${labelKey}_name`] ||
                      (entry as any).user_name ||
                      (entry as any).display_name ||
                      (entry as any).entity_name ||
                      "Unknown";

                    const score = entry.average_normalized_score ?? null;
                    const normalizedScore =
                      typeof score === "number"
                        ? score
                        : (() => {
                            const avgBrix = entry.average_brix;
                            return typeof avgBrix === "number"
                              ? computeNormalizedScore(avgBrix)
                              : 1.5;
                          })();

                    const rank = entry.rank ?? idx + 1;
                    const isTie = rankCounts[rank] > 1;

                    return (
                      <div
                        key={(entry as any)[`${labelKey}_id`] ?? label ?? idx}
                        onClick={() => onNavigate(entry, labelKey)}
                        className={`grid ${DESKTOP_COLS} gap-x-6 items-center px-4 py-3 border-b border-hairline last:border-0 hover:bg-surface-canvas transition-colors text-sm ${
                          labelKey !== "user" ? "cursor-pointer" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <RankLaurel rank={rank} />
                          {isTie && (
                            <span className="text-xs text-text-muted-brown mt-1">(tie)</span>
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="font-medium text-text-dark">{labelKey === 'user' ? formatUsername(label) : label}</div>
                          {labelKey === "location" && (
                            <div className="text-xs text-text-muted-brown">
                              {formatVenueLocation((entry as any).street_address, (entry as any).city, (entry as any).state)}
                            </div>
                          )}
                        </div>

                        {showDetailColumns && (
                          <>
                            <div className="text-center tabular-nums text-text-mid">
                              {entry.submission_count ?? 0}
                            </div>
                            <div className="text-center font-mono tabular-nums text-text-mid">
                              {typeof entry.average_brix === 'number'
                                ? entry.average_brix.toFixed(1)
                                : <span className="text-text-muted-brown">--</span>}
                            </div>
                          </>
                        )}

                        <div className="text-center">
                          {labelKey === "user" ? (
                            <span className="font-display font-bold text-sm text-text-dark">
                              {entry.submission_count ?? 0}
                            </span>
                          ) : (
                            <ScoreGauge normalizedScore={normalizedScore} />
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {hasMore && (
                <div className="p-3 border-t border-hairline">
                  <button
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    className="w-full flex items-center justify-center gap-2 text-sm text-green-fresh hover:text-green-mid disabled:text-text-muted-brown"
                  >
                    <span>{isLoadingMore ? 'Loading…' : 'Load more'}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="lb-mobile-only">
              <LeaderboardMobileList
                data={data}
                labelKey={labelKey}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={onLoadMore}
                onNavigate={onNavigate}
              />
            </div>
            </>
          )}
        </div>
      </CardContent>
    </div>
  );
}
