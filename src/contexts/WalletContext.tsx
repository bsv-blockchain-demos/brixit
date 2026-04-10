import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { WalletClient } from '@bsv/sdk';
import { useNavigate } from 'react-router-dom';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 3000; // 3 s, 6 s, 12 s with exponential backoff

type WalletContextType = {
  userWallet: WalletClient | null;
  userPubKey: string | null;
  isConnecting: boolean;
  maxRetriesExceeded: boolean;
  retryCount: number;
  initializeWallet: () => Promise<void>;
  resetWalletState: () => void;
  /** Inject a relay wallet (mobile QR flow) as the active wallet. */
  setRelayWallet: (wallet: WalletClient, pubKey: string) => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userWallet, setUserWallet] = useState<WalletClient | null>(null);
  const [userPubKey, setUserPubKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetriesExceeded, setMaxRetriesExceeded] = useState(false);
  // Refs track retry state without causing useCallback to recreate on every retry
  const retryCountRef = useRef(0);
  const maxRetriesExceededRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializingRef = useRef(false);
  const hasAutoInitialized = useRef(false);
  const relaySourceRef = useRef(false); // true when userWallet was injected from relay

  const navigate = useNavigate();

  const initializeWallet = useCallback(async () => {
    if (isInitializingRef.current || maxRetriesExceededRef.current) return;

    isInitializingRef.current = true;
    setIsConnecting(true);

    try {
      const newWallet = new WalletClient('auto');
      const isConnected = await newWallet.isAuthenticated();

      if (!isConnected) {
        throw new Error('Wallet not authenticated');
      }

      const { publicKey } = await newWallet.getPublicKey({ identityKey: true });

      setUserWallet(newWallet);
      setUserPubKey(publicKey);
      retryCountRef.current = 0;
      setRetryCount(0);
      setIsConnecting(false);

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Failed to initialize wallet:', error);

      const currentRetry = retryCountRef.current;
      if (currentRetry < MAX_RETRIES) {
        retryCountRef.current = currentRetry + 1;
        setRetryCount(currentRetry + 1);
        // Exponential backoff: 3 s, 6 s, 12 s
        const delay = RETRY_BASE_MS * Math.pow(2, currentRetry);
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          isInitializingRef.current = false;
          initializeWallet();
        }, delay);
      } else {
        maxRetriesExceededRef.current = true;
        setMaxRetriesExceeded(true);
        setIsConnecting(false);
        navigate('/wallet-error');
      }
    } finally {
      isInitializingRef.current = false;
      if (!retryTimeoutRef.current) {
        setIsConnecting(false);
      }
    }
  }, [navigate]); // navigate is the only external dep; retry state tracked via refs

  const setRelayWallet = useCallback((wallet: WalletClient, pubKey: string) => {
    // Cancel any in-flight initializeWallet retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
    maxRetriesExceededRef.current = false;
    isInitializingRef.current = false;
    setRetryCount(0);
    setMaxRetriesExceeded(false);
    setIsConnecting(false);

    relaySourceRef.current = true;
    setUserWallet(wallet);
    setUserPubKey(pubKey);
  }, []);

  const resetWalletState = useCallback(() => {
    retryCountRef.current = 0;
    maxRetriesExceededRef.current = false;
    setRetryCount(0);
    setMaxRetriesExceeded(false);
    setIsConnecting(false);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (relaySourceRef.current) {
      relaySourceRef.current = false;
      setUserWallet(null);
      setUserPubKey(null);
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return (
    <WalletContext.Provider value={{
      userWallet,
      userPubKey,
      isConnecting,
      maxRetriesExceeded,
      retryCount,
      initializeWallet,
      resetWalletState,
      setRelayWallet
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
