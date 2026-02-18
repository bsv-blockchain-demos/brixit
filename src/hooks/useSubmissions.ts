import { useQuery } from "@tanstack/react-query";
import type { BrixDataPoint } from "@/types";
import { fetchFormattedSubmissions, fetchMySubmissions } from "@/lib/fetchSubmissions";

const ONE_HOUR_MS = 60 * 60 * 1000;

export function useFormattedSubmissionsQuery() {
  return useQuery<BrixDataPoint[]>({
    queryKey: ["submissions", "public_formatted"],
    queryFn: () => fetchFormattedSubmissions(),
    staleTime: ONE_HOUR_MS,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useMySubmissionsQuery(userId?: string) {
  return useQuery<BrixDataPoint[]>({
    queryKey: ["submissions", "mine", userId || null],
    queryFn: () => {
      if (!userId) return Promise.resolve([]);
      return fetchMySubmissions(userId);
    },
    enabled: !!userId,
    staleTime: ONE_HOUR_MS,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
