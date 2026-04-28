import React from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
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

function getRankBadgeStyle(rank: number): React.CSSProperties {
  if (rank === 1) return { backgroundColor: '#FBBF24', color: '#78350F' };
  if (rank === 2) return { backgroundColor: '#94A3B8', color: '#0F172A' };
  if (rank === 3) return { backgroundColor: '#C2763A', color: '#ffffff' };
  return { backgroundColor: 'var(--badge-neutral-bg)', color: 'var(--badge-neutral-text)' };
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
    <Card className="w-full border border-blue-pale rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
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
            <div>
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}
