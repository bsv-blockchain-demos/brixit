import { useEffect, useRef, useState } from 'react';
import { useWalletRelayClient } from '@bsv/wallet-relay/react';
import { Utils, createNonce } from '@bsv/sdk';
import { useAuth } from '@/contexts/AuthContext';
import { getDataFromWallet } from '@/utils/getDataFromWallet';

const MYCELIA_CERTIFIER_KEY = import.meta.env.VITE_SERVER_PUBLIC_KEY as string;
const MYCELIA_CERT_TYPE = (import.meta.env.VITE_CERT_TYPE as string) || 'Brixit Identity';
const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';
const BACKEND_PUBLIC_KEY = import.meta.env.VITE_SERVER_PUBLIC_KEY as string;

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

  const { walletLogin } = useAuth();

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
          certifiers: [MYCELIA_CERTIFIER_KEY],
          types: [Utils.toBase64(Utils.toArray(MYCELIA_CERT_TYPE, 'utf8'))],
          limit: 1,
        });

        if (!certificates || certificates.length === 0) {
          throw new Error('NO_CERTIFICATE');
        }

        const certificate = certificates[0];
        const userData = await getDataFromWallet(wallet, certificate);

        if (!userData) {
          throw new Error('Unable to retrieve wallet profile data.');
        }

        const nonce = await createNonce(wallet as any, BACKEND_PUBLIC_KEY);
        const success = await walletLogin(identityKey, certificate, userData, nonce);
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
