import { createContext, useContext } from 'react';

export interface BrixGuideContextValue {
  /** Whether the guide modal is open. */
  isOpen: boolean;
  /** Open the guide modal. */
  open: () => void;
  /** Close the guide modal. */
  close: () => void;
  /** Whether the entry-point banner is hidden ("don't show again", persisted). */
  bannerHidden: boolean;
  /** Persist "don't show again". Hides the banner on every form page. */
  hideBanner: () => void;
  /** Un-hide the banner (restore). */
  showBanner: () => void;
}

export const BrixGuideContext = createContext<BrixGuideContextValue | null>(null);

export function useBrixGuide(): BrixGuideContextValue {
  const ctx = useContext(BrixGuideContext);
  if (!ctx) {
    throw new Error('useBrixGuide must be used within a <BrixGuideProvider>');
  }
  return ctx;
}
