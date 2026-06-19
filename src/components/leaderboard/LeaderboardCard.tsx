import React from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "../ui/card";
import { LeaderboardEntry } from "../../lib/fetchLeaderboards";
import { computeNormalizedScore } from "../../lib/getBrixColor";
import { ScoreBadge } from "../common/ScoreBadge";
import { formatUsername } from "../../lib/formatUsername";
import { formatVenueLocation } from "../../lib/formatAddress";

interface LeaderboardCardProps {
  title: string;
  data: LeaderboardEntry[];
  labelKey: 'location' | 'brand' | 'user';
  loadMoreType: 'location' | 'brand' | 'user';
  hasMore: boolean;
  isFirstLoad: boolean;
  isFetching: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onNavigate: (entry: any, type: 'location' | 'brand' | 'user') => void;
}

// Rank medal styling — token-backed so it adapts to light/dark. Shared by the
// desktop table and the mobile card list. 1st/2nd/3rd use rank tokens; 4th+
// falls back to the neutral badge token.
function getRankBadgeStyle(rank: number): React.CSSProperties {
  if (rank === 1) return { backgroundColor: 'var(--rank-1-bg)', color: 'var(--rank-1-fg)' };
  if (rank === 2) return { backgroundColor: 'var(--rank-2-bg)', color: 'var(--rank-2-fg)' };
  if (rank === 3) return { backgroundColor: 'var(--rank-3-bg)', color: 'var(--rank-3-fg)' };
  return { backgroundColor: 'var(--badge-neutral-bg)', color: 'var(--badge-neutral-text)' };
}

/* Mobile-only card list (≤640px). Presentation only; the rank/tie/score
   derivation mirrors the desktop table so displayed values match exactly.
   All colors come from design tokens (Tailwind token classes, ScoreBadge,
   and getRankBadgeStyle) so it renders correctly in light and dark mode. */
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
            className={`flex items-center gap-3 px-4 py-3 border-b border-blue-pale last:border-b-0 ${
              clickable ? 'cursor-pointer' : ''
            }`}
          >
            {/* Left: rank medal (+ tie label) */}
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <span
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-bold text-sm"
                style={getRankBadgeStyle(rank)}
              >
                {rank}
              </span>
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
              <div className="mt-0.5 text-xs text-text-muted-brown">{subs} submissions</div>
            </div>

            {/* Right: score badge (boards) or submission count (user board) */}
            <div className="shrink-0">
              {labelKey === 'user' ? (
                <span className="font-display font-bold text-base text-text-dark">{subs}</span>
              ) : (
                <ScoreBadge normalizedScore={normalizedScore} size="sm" />
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


export function LeaderboardCard({
  title,
  data,
  labelKey,
  hasMore,
  isFirstLoad,
  isFetching,
  isLoadingMore,
  onLoadMore,
  onNavigate,
}: LeaderboardCardProps) {
  return (
    <div className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold font-display text-text-dark text-center">{title}</CardTitle>
        {labelKey === "user" && (
          <p className="text-sm text-muted-foreground text-center mt-1">
            Global rankings • All users
          </p>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className={isFirstLoad || isFetching ? 'opacity-50 pointer-events-none' : ''}>
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-text-muted-brown">No data available.</div>
          ) : (
            <>
            <div className="lb-desktop-only">
              <div className="grid grid-cols-3 text-xs font-medium text-text-muted-brown uppercase tracking-wider border-b border-blue-pale px-4 py-2 bg-table-header">
                <span className="text-left">
                  {labelKey === "location" ? "Store" : "Name"}
                </span>
                <span className="text-center">
                  {labelKey === "user" ? "Submissions" : "Score"}
                </span>
                <span className="text-center">Rank</span>
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
                        className={`grid grid-cols-3 items-center px-4 py-2 border-b border-blue-pale last:border-0 odd:bg-card even:bg-table-stripe hover:bg-table-stripe transition-colors text-sm ${
                          labelKey !== "user" ? "cursor-pointer" : ""
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="font-medium text-text-dark">{labelKey === 'user' ? formatUsername(label) : label}</div>
                          {labelKey === "location" && (
                            <div className="text-xs text-text-muted-brown">
                              {formatVenueLocation((entry as any).street_address, (entry as any).city, (entry as any).state)}
                            </div>
                          )}
                          <div className="mt-1 text-xs text-text-muted-brown">
                            {entry.submission_count ?? 0} submissions
                          </div>
                        </div>

                        <div className="text-center">
                          {labelKey === "user" ? (
                            <span className="font-display font-bold text-sm text-text-dark">
                              {entry.submission_count ?? 0}
                            </span>
                          ) : (
                            <ScoreBadge normalizedScore={normalizedScore} size="sm" />
                          )}
                        </div>

                        <div className="flex flex-col items-center">
                          <span
                            className="px-3 py-1 text-sm font-semibold rounded-full"
                            style={getRankBadgeStyle(rank)}
                          >
                            {rank}
                          </span>
                          {isTie && (
                            <span className="text-xs text-text-muted-brown mt-1">(tie)</span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {hasMore && (
                <div className="p-3 border-t border-blue-pale">
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
