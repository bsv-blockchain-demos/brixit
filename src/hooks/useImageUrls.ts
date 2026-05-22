/**
 * Resolves a submission's S3 image keys to presigned GET URLs and caches them
 * in React Query so two display sites for the same submission share one fetch.
 *
 * Presigned URLs have a 1-hour TTL on the server; we refetch slightly before
 * that (55 min) to avoid showing a freshly-expired link.
 */
import { useQuery } from '@tanstack/react-query';
import { getImageUrls } from '../lib/uploadApi';

const STALE_MS = 55 * 60 * 1000;
const GC_MS = 60 * 60 * 1000;

export function useImageUrls(submissionId: string | undefined, keys: string[]) {
  return useQuery<string[]>({
    // Cache per submission — same submission viewed twice reuses the same URLs.
    queryKey: ['submissionImageUrls', submissionId ?? null],
    queryFn: async () => {
      if (keys.length === 0) return [];
      const map = await getImageUrls(keys);
      return keys.map((k) => map[k]).filter((u): u is string => !!u);
    },
    enabled: !!submissionId && keys.length > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
