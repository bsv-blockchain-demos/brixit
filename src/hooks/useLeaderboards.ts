import { useQuery } from "@tanstack/react-query";
import {
  fetchBrandLeaderboard,
  fetchLocationLeaderboard,
  fetchUserLeaderboard,
  type Filter,
  type LeaderboardEntry,
} from "@/lib/fetchLeaderboards";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function normalizeLeaderboardFilters(filters: Filter) {
  return {
    country: filters.country || undefined,
    state: filters.state || undefined,
    city: filters.city || undefined,
    crop: filters.crop || undefined,
    limit: typeof filters.limit === "number" ? filters.limit : 50,
    offset: typeof filters.offset === "number" ? filters.offset : 0,
  } satisfies Filter;
}

export function useLocationLeaderboardQuery(filters: Filter) {
  const normalized = normalizeLeaderboardFilters(filters);

  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard", "location", normalized],
    queryFn: () => fetchLocationLeaderboard(normalized),
    staleTime: FIVE_MINUTES_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useBrandLeaderboardQuery(filters: Filter) {
  const normalized = normalizeLeaderboardFilters(filters);

  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard", "brand", normalized],
    queryFn: () => fetchBrandLeaderboard(normalized),
    staleTime: FIVE_MINUTES_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useUserLeaderboardQuery(filters: Filter) {
  const normalized = normalizeLeaderboardFilters(filters);

  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard", "user", normalized],
    queryFn: () => fetchUserLeaderboard(normalized),
    staleTime: FIVE_MINUTES_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
