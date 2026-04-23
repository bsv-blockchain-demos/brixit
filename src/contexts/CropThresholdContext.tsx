import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiGet } from '../lib/api';
import { BrixThresholds } from '../lib/getBrixQuality';

type CropThresholdCache = Record<string, BrixThresholds>;

type CropThresholdContextType = {
  cache: CropThresholdCache;
  getThresholds: (name: string) => BrixThresholds | null;
  loading: boolean;
  reloadCache: () => Promise<void>;
};

const CropThresholdContext = createContext<CropThresholdContextType | undefined>(undefined);

type CropThresholdProviderProps = {
  children: ReactNode;
};

export const CropThresholdProvider: React.FC<CropThresholdProviderProps> = ({ children }) => {
  const [cache, setCache] = useState<CropThresholdCache>({});
  const [loading, setLoading] = useState(true);

  const storageKey = 'crop_threshold_cache_v1';
  const ttlMs = 60 * 60 * 1000;

  const readFromStorage = (): CropThresholdCache | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { cachedAt: number; cache: CropThresholdCache };
      if (!parsed?.cachedAt || !parsed?.cache) return null;
      if (Date.now() - parsed.cachedAt > ttlMs) return null;
      return parsed.cache;
    } catch {
      return null;
    }
  };

  const writeToStorage = (next: CropThresholdCache) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ cachedAt: Date.now(), cache: next }));
    } catch {
      // ignore storage errors
    }
  };

  const reloadCache = async () => {
    setLoading(true);

    try {
      const fromStorage = readFromStorage();
      if (fromStorage) {
        setCache(fromStorage);
        return;
      }

      const next = await apiGet<CropThresholdCache>('/api/crops/thresholds', { skipAuth: true });

      setCache(next);
      writeToStorage(next);
    } catch (error) {
      console.error('🌾 CropThresholdContext: Error reloading cache:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadCache();
  }, []);

  const getThresholds = useCallback((name: string): BrixThresholds | null => {
    return cache[name.toLowerCase().trim()] ?? null;
  }, [cache]);

  return (
    <CropThresholdContext.Provider value={{ cache, getThresholds, loading, reloadCache }}>
      {children}
    </CropThresholdContext.Provider>
  );
};

export const useCropThresholds = () => {
  const ctx = useContext(CropThresholdContext);
  if (!ctx) throw new Error('useCropThresholds must be used inside CropThresholdProvider');
  return ctx;
};
