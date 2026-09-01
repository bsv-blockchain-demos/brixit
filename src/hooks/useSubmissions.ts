import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { BrixDataPoint } from "@/types";
import {
  fetchFormattedSubmissions,
  fetchFormattedSubmissionsCount,
  fetchFormattedSubmissionsInBounds,
  fetchFormattedSubmissionsPage,
  fetchMineFormattedSubmissionsPage,
  fetchMineFormattedSubmissionsCount,
  fetchFormattedSubmissionById,
  fetchMySubmissionsCount,
  fetchMySubmissionsCropIds,
  fetchMySubmissionsVenueIds,
  fetchMySubmissionsPage,
  fetchMySubmissions,
  type MySubmissionsCountQuery,
  type MySubmissionsPageQuery,
  type PublicFormattedSubmissionsQuery,
  type PublicFormattedSubmissionsBoundsQuery,
} from "@/lib/fetchSubmissions";

/**
 * The mock-data condition is written inline at each call site rather than
 * hoisted into a const. A `const x = false` is not reliably propagated into
 * nested closures by the minifier, which leaves the dynamic import reachable
 * and ships the whole mock dataset. Inlined, it folds to `false ? ... : ...`
 * before minification and the import is dropped.
 */
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

/** `scope` picks the public list or the signed-in user's own readings. */
export type SubmissionScope = "all" | "mine";

export function useFormattedSubmissionsPageQuery(
  query: PublicFormattedSubmissionsQuery,
  scope: SubmissionScope = "all",
) {
  return useQuery<BrixDataPoint[]>({
    // scope is part of the key: the two scopes are different result sets for
    // an otherwise identical query.
    queryKey: ["submissions", "public_formatted", "page", scope, query],
    queryFn: () =>
      import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_DATA === "1"
        ? import("@/lib/devMockData").then((m) => m.mockSubmissionsPage(query, scope))
        : scope === "mine"
          ? fetchMineFormattedSubmissionsPage(query)
          : fetchFormattedSubmissionsPage(query),
    staleTime: ONE_HOUR_MS,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}

export function useFormattedSubmissionsCountQuery(
  query: Omit<PublicFormattedSubmissionsQuery, "limit" | "offset">,
  scope: SubmissionScope = "all",
) {
  return useQuery<number>({
    queryKey: ["submissions", "public_formatted", "count", scope, query],
    queryFn: () =>
      import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_DATA === "1"
        ? import("@/lib/devMockData").then((m) => m.mockSubmissionsCount(query, scope))
        : scope === "mine"
          ? fetchMineFormattedSubmissionsCount(query)
          : fetchFormattedSubmissionsCount(query),
    staleTime: ONE_HOUR_MS,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
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
      return import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_DATA === "1"
        ? import("@/lib/devMockData").then((m) => m.mockMineCount(query.verified))
        : fetchMySubmissionsCount(query);
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
      return import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_DATA === "1"
        ? import("@/lib/devMockData").then((m) => m.mockMineCropIds())
        : fetchMySubmissionsCropIds(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useMySubmissionsVenueIdsQuery(userId?: string) {
  return useQuery<string[]>({
    queryKey: ["submissions", "mine", "venue_ids", userId || null],
    queryFn: () => {
      if (!userId) return Promise.resolve([]);
      return import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_DATA === "1"
        ? import("@/lib/devMockData").then((m) => m.mockMineVenueIds())
        : fetchMySubmissionsVenueIds(userId);
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
