import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { WalletRelayClient } from '@bsv/wallet-relay/client';
import type { SessionInfo, RequestLogEntry, WalletResponse, WalletMethodName } from '@bsv/wallet-relay/client';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

interface WalletRelayContextType {
  session: SessionInfo | null;
  log: RequestLogEntry[];
  error: string | null;
  createSession: () => Promise<SessionInfo>;
  sendRequest: (method: WalletMethodName, params?: unknown) => Promise<WalletResponse>;
  /** Tear down the active relay session (stop polling) and reset state. Safe to call with no session. */
  cancelSession: () => void;
  wallet: WalletRelayClient['wallet'] | null;
}

const WalletRelayContext = createContext<WalletRelayContextType | undefined>(undefined);

/**
 * Keeps a single WalletRelayClient alive above the router so the relay session
 * (and HTTP polling) survives navigation between /mobile-login and /create-account.
 *
 * We drive the WalletRelayClient directly rather than via `useWalletRelayClient`
 * so we can expose `cancelSession`: the relay hook only calls the client's
 * `destroy()` on unmount and never surfaces it, yet logout and leaving
 * /mobile-login need to stop an in-flight session on demand.
 */
export function WalletRelayProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [log, setLog] = useState<RequestLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<WalletRelayClient | null>(null);

  // Created lazily on first use (matches the hook's autoCreate: false behaviour).
  function ensureClient() {
    if (!clientRef.current) {
      clientRef.current = new WalletRelayClient({
        apiUrl: API_URL,
        onSessionChange: setSession,
        onLogChange: setLog,
        onError: setError,
      });
    }
    return clientRef.current;
  }

  const createSession = useCallback(() => {
    setError(null);
    return ensureClient().createSession();
  }, []);

  const sendRequest = useCallback(
    (method: WalletMethodName, params?: unknown) => ensureClient().sendRequest(method, params),
    [],
  );

  const cancelSession = useCallback(() => {
    clientRef.current?.destroy();
    clientRef.current = null;
    setSession(null);
    setLog([]);
    setError(null);
  }, []);

  // Stop polling if the provider itself ever unmounts.
  useEffect(
    () => () => {
      clientRef.current?.destroy();
      clientRef.current = null;
    },
    [],
  );

  const wallet = session?.status === 'connected' ? clientRef.current?.wallet ?? null : null;

  return (
    <WalletRelayContext.Provider value={{ session, log, error, createSession, sendRequest, cancelSession, wallet }}>
      {children}
    </WalletRelayContext.Provider>
  );
}

export function useWalletRelay(): WalletRelayContextType {
  const ctx = useContext(WalletRelayContext);
  if (!ctx) throw new Error('useWalletRelay must be used within WalletRelayProvider');
  return ctx;
}
