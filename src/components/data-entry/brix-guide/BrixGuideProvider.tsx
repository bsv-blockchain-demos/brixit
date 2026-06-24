import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { BrixGuideContext } from './useBrixGuide';
import { BrixGuideModal } from './BrixGuideModal';

const STORAGE_KEY = 'brix_guide_banner_hidden_v1';

const readHidden = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Hosts the shared "30-second Brix guide" modal and the persisted banner state.
 * Wrap the submission form in this so the banner and the inline "How do I get
 * this?" triggers all open the same modal. Renders the modal once (portaled),
 * so placement of the provider in the tree does not matter.
 */
export function BrixGuideProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [bannerHidden, setBannerHidden] = useState<boolean>(readHidden);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const hideBanner = useCallback(() => {
    setBannerHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* storage unavailable, keep in-memory state only */
    }
  }, []);

  const showBanner = useCallback(() => {
    setBannerHidden(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ isOpen, open, close, bannerHidden, hideBanner, showBanner }),
    [isOpen, open, close, bannerHidden, hideBanner, showBanner],
  );

  return (
    <BrixGuideContext.Provider value={value}>
      {children}
      <BrixGuideModal />
    </BrixGuideContext.Provider>
  );
}
