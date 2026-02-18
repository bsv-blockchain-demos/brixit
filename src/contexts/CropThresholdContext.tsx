import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../integrations/supabase/client';
import { BrixThresholds } from '../lib/getBrixQuality';

type CropThresholdCache = Record<string, BrixThresholds>;

type CropThresholdContextType = {
  cache: CropThresholdCache;
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

      const { data, error } = await supabase
        .from('crops')
        .select('name, poor_brix, average_brix, good_brix, excellent_brix');

      if (error) {
        console.error('🌾 CropThresholdContext: Error fetching crop thresholds:', error);
        return;
      }

      const next: CropThresholdCache = {};
      for (const row of data || []) {
        const normalizedCropName = (row as any).name?.toLowerCase?.().trim?.();
        if (!normalizedCropName) continue;
        next[normalizedCropName] = {
          poor: Number((row as any).poor_brix) || 0,
          average: Number((row as any).average_brix) || 0,
          good: Number((row as any).good_brix) || 0,
          excellent: Number((row as any).excellent_brix) || 0,
        };
      }

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

  return (
    <CropThresholdContext.Provider value={{ cache, loading, reloadCache }}>
      {children}
    </CropThresholdContext.Provider>
  );
};

export const useCropThresholds = () => {
  const ctx = useContext(CropThresholdContext);
  if (!ctx) throw new Error('useCropThresholds must be used inside CropThresholdProvider');
  return ctx;
};
