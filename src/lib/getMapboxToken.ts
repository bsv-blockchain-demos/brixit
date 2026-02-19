export async function getMapboxToken(): Promise<string | null> {
  const token =
    import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
    import.meta.env.VITE_MAPBOX_TOKEN ||
    null;

  if (!token) {
    console.error('Missing Mapbox token. Set VITE_MAPBOX_ACCESS_TOKEN (or VITE_MAPBOX_TOKEN).');
    return null;
  }

  return token;
}
