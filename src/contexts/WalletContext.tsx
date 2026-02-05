import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { WalletClient } from '@bsv/sdk';
import { useNavigate } from 'react-router-dom';

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 3000;

type WalletContextType = {
  userWallet: WalletClient | null;
  userPubKey: string | null;
  isConnecting: boolean;
  maxRetriesExceeded: boolean;
  retryCount: number;
  initializeWallet: () => Promise<void>;
  resetWalletState: () => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userWallet, setUserWallet] = useState<WalletClient | null>(null);
  const [userPubKey, setUserPubKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetriesExceeded, setMaxRetriesExceeded] = useState(false);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializingRef = useRef(false);
  const hasAutoInitialized = useRef(false);

  const navigate = useNavigate();

  const initializeWallet = useCallback(async () => {
    if (isInitializingRef.current || maxRetriesExceeded) return;

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
      setIsConnecting(false);

      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    } catch (error) {
      console.error('Failed to initialize wallet:', error);

      if (!retryIntervalRef.current && retryCount < MAX_RETRIES) {
        retryIntervalRef.current = setInterval(() => {
          setRetryCount((prev) => {
            const newCount = prev + 1;
            if (newCount >= MAX_RETRIES) {
              if (retryIntervalRef.current) {
                clearInterval(retryIntervalRef.current);
                retryIntervalRef.current = null;
              }
              setMaxRetriesExceeded(true);
              setIsConnecting(false);
              navigate('/wallet-error');
            }
            return newCount;
          });

          isInitializingRef.current = false;
          initializeWallet();
        }, RETRY_INTERVAL_MS);
      }
    } finally {
      isInitializingRef.current = false;
      if (!retryIntervalRef.current) {
        setIsConnecting(false);
      }
    }
  }, [retryCount, maxRetriesExceeded, navigate]);

  const resetWalletState = useCallback(() => {
    setRetryCount(0);
    setMaxRetriesExceeded(false);
    setIsConnecting(false);
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
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
      resetWalletState
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
