import { createContext, useContext, type ReactNode } from 'react';
import { useWalletRelayClient } from '@bsv/wallet-relay/react';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

type WalletRelayContextType = ReturnType<typeof useWalletRelayClient>;

const WalletRelayContext = createContext<WalletRelayContextType | undefined>(undefined);

/**
 * Keeps a single WalletRelayClient alive above the router so the relay session
 * (and HTTP polling) survives navigation between /mobile-login and /create-account.
 */
export function WalletRelayProvider({ children }: { children: ReactNode }) {
  const relay = useWalletRelayClient({ apiUrl: API_URL, autoCreate: false });
  return (
    <WalletRelayContext.Provider value={relay}>
      {children}
    </WalletRelayContext.Provider>
  );
}

export function useWalletRelay(): WalletRelayContextType {
  const ctx = useContext(WalletRelayContext);
  if (!ctx) throw new Error('useWalletRelay must be used within WalletRelayProvider');
  return ctx;
}
