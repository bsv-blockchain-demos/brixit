import { useEffect, useRef, useState } from 'react';
import { useWalletRelayClient } from '@bsv/wallet-relay/react';
import { Utils } from '@bsv/sdk';
import { useAuth } from '@/contexts/AuthContext';

const COMMONSOURCE_SERVER_KEY = import.meta.env.VITE_COMMONSOURCE_SERVER_KEY as string;
const CERT_TYPE = (import.meta.env.VITE_CERT_TYPE as string) || 'CommonSource identity';
const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

export type MobileLoginStatus =
  | 'idle'
  | 'scanning'       // session created, QR displayed, waiting for mobile to connect
  | 'authenticating' // mobile connected, retrieving identity and certificates
  | 'done'
  | 'error';

export function useMobileWalletLogin() {
  const [loginStatus, setLoginStatus] = useState<MobileLoginStatus>('idle');
  const [loginError, setLoginError] = useState<string | null>(null);
  const authRunningRef = useRef(false); // prevent double-fire (StrictMode)

  const { session, error: relayError, createSession, wallet } = useWalletRelayClient({
    apiUrl: API_URL,
    autoCreate: false,
  });

  const { mobileWalletLogin } = useAuth();

  // Start the flow: create a relay session and show the QR code
  const start = () => {
    setLoginError(null);
    setLoginStatus('scanning');
    void createSession();
  };

  const reset = () => {
    setLoginStatus('idle');
    setLoginError(null);
    authRunningRef.current = false;
  };

  // When the mobile connects, run the auth flow using wallet directly —
  // no separate sendRequest calls needed, wallet calls look identical to local wallet calls
  useEffect(() => {
    if (session?.status !== 'connected' || !wallet) return;
    if (authRunningRef.current) return;
    authRunningRef.current = true;

    const authenticate = async () => {
      setLoginStatus('authenticating');
      try {
        const { publicKey: identityKey } = await wallet.getPublicKey({ identityKey: true });

        const { certificates } = await wallet.listCertificates({
          certifiers: [COMMONSOURCE_SERVER_KEY],
          types: [Utils.toBase64(Utils.toArray(CERT_TYPE))],
          limit: 1,
        });

        if (!certificates || certificates.length === 0) {
          throw new Error('NO_CERTIFICATE');
        }

        const success = await mobileWalletLogin(identityKey, certificates[0]);
        if (!success) throw new Error('Authentication failed. Please try again.');

        setLoginStatus('done');
      } catch (err: unknown) {
        authRunningRef.current = false;
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setLoginError(message);
        setLoginStatus('error');
      }
    };

    void authenticate();
  }, [session?.status, wallet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Surface relay errors (session creation failure)
  useEffect(() => {
    if (relayError && loginStatus === 'scanning') {
      setLoginError(relayError);
      setLoginStatus('error');
    }
  }, [relayError, loginStatus]);

  return { session, loginStatus, loginError, start, reset };
}
