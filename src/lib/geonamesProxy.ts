import { apiFetch } from '@/lib/api';

interface GeoNamesProxyParams {
  endpoint: string;
  queryParams: Record<string, string>;
}

export async function fetchFromGeonamesProxy({ endpoint, queryParams }: GeoNamesProxyParams) {
  const encodedParams = btoa(new URLSearchParams(queryParams).toString());

  const url = `/api/geonames?endpoint=${encodeURIComponent(endpoint)}&params=${encodeURIComponent(encodedParams)}`;

  const response = await apiFetch(url, { method: 'GET' });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('GeoNames proxy error:', response.status, errorText);
    throw new Error(`GeoNames proxy failed with status ${response.status}`);
  }

  return response.json();
}
