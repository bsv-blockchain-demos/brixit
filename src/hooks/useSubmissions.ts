import { useQuery } from "@tanstack/react-query";
import type { BrixDataPoint } from "@/types";
import {
  fetchFormattedSubmissions,
  fetchFormattedSubmissionsCount,
  fetchFormattedSubmissionsInBounds,
  fetchFormattedSubmissionsPage,
  fetchFormattedSubmissionById,
  fetchMySubmissionsCount,
  fetchMySubmissionsCropIds,
  fetchMySubmissionsPage,
  fetchMySubmissions,
  type MySubmissionsCountQuery,
  type MySubmissionsPageQuery,
  type PublicFormattedSubmissionsQuery,
  type PublicFormattedSubmissionsBoundsQuery,
} from "@/lib/fetchSubmissions";

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

export function useFormattedSubmissionsPageQuery(query: PublicFormattedSubmissionsQuery) {
  return useQuery<BrixDataPoint[]>({
    queryKey: ["submissions", "public_formatted", "page", query],
    queryFn: () => fetchFormattedSubmissionsPage(query),
    staleTime: ONE_HOUR_MS,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useFormattedSubmissionsCountQuery(
  query: Omit<PublicFormattedSubmissionsQuery, "limit" | "offset">
) {
  return useQuery<number>({
    queryKey: ["submissions", "public_formatted", "count", query],
    queryFn: () => fetchFormattedSubmissionsCount(query),
    staleTime: ONE_HOUR_MS,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

function quantize(n: number, decimals: number) {
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
}

export function useFormattedSubmissionsBoundsQuery(
  query?: PublicFormattedSubmissionsBoundsQuery,
  options?: { enabled?: boolean; staleTimeMs?: number; gcTimeMs?: number }
) {
  const enabled = options?.enabled ?? !!query;
  const staleTime = options?.staleTimeMs ?? 10 * 60 * 1000;
  const gcTime = options?.gcTimeMs ?? 60 * 60 * 1000;

  const quantized = query
    ? {
        ...query,
        west: quantize(query.west, 2),
        south: quantize(query.south, 2),
        east: quantize(query.east, 2),
        north: quantize(query.north, 2),
      }
    : null;

  const effectiveQuery = quantized;

  return useQuery<BrixDataPoint[]>({
    queryKey: ["submissions", "public_formatted", "bounds", effectiveQuery],
    queryFn: () => {
      if (!effectiveQuery) return Promise.resolve([]);
      return fetchFormattedSubmissionsInBounds(effectiveQuery);
    },
    enabled,
    staleTime,
    gcTime,
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
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useMySubmissionsPageQuery(query?: MySubmissionsPageQuery) {
  return useQuery<BrixDataPoint[]>({
    queryKey: ["submissions", "mine", "page", query || null],
    queryFn: () => {
      if (!query) return Promise.resolve([]);
      return fetchMySubmissionsPage(query);
    },
    enabled: !!query?.userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useMySubmissionsCountQuery(query?: MySubmissionsCountQuery) {
  return useQuery<number>({
    queryKey: ["submissions", "mine", "count", query || null],
    queryFn: () => {
      if (!query) return Promise.resolve(0);
      return fetchMySubmissionsCount(query);
    },
    enabled: !!query?.userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useMySubmissionsCropIdsQuery(userId?: string) {
  return useQuery<string[]>({
    queryKey: ["submissions", "mine", "crop_ids", userId || null],
    queryFn: () => {
      if (!userId) return Promise.resolve([]);
      return fetchMySubmissionsCropIds(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useFormattedSubmissionByIdQuery(
  id?: string,
  options?: { enabled?: boolean; staleTimeMs?: number; gcTimeMs?: number }
) {
  const enabled = options?.enabled ?? !!id;
  const staleTime = options?.staleTimeMs ?? 10 * 60 * 1000;
  const gcTime = options?.gcTimeMs ?? 60 * 60 * 1000;

  const safeId = (id ?? '').toString().trim();

  return useQuery<BrixDataPoint | null>({
    queryKey: ["submissions", "public_formatted", "by_id", safeId || null],
    queryFn: () => {
      if (!safeId) return Promise.resolve(null);
      return fetchFormattedSubmissionById(safeId);
    },
    enabled: enabled && !!safeId,
    staleTime,
    gcTime,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
