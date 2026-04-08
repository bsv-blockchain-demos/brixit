import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { Utils, createNonce } from '@bsv/sdk';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Lock, TrendingUp, Smartphone } from 'lucide-react';
import { getDataFromWallet } from '@/utils/getDataFromWallet';
import { useMobileWalletLogin } from '@/hooks/useMobileWalletLogin';

const MYCELIA_CERT_TYPE = import.meta.env.VITE_MYCELIA_CERT_TYPE || 'Brixit Identity';
const MYCELIA_CERTIFIER_KEY = import.meta.env.VITE_SERVER_PUBLIC_KEY;
const BACKEND_PUBLIC_KEY = import.meta.env.VITE_SERVER_PUBLIC_KEY;

export default function WalletLogin() {
  const [searchParams] = useSearchParams();
  const { userWallet, userPubKey, isConnecting, maxRetriesExceeded, retryCount, initializeWallet, resetWalletState } = useWallet();
  const { walletLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [isCheckingCertificates, setIsCheckingCertificates] = useState(false);
  const [hasStartedLogin, setHasStartedLogin] = useState(false);
  const isFetchingRef = useRef(false); // prevents concurrent invocations (StrictMode + re-render races)

  // autocert=1 means we just created an account — wallet is already connected, skip the button
  const comingFromAccountCreation = searchParams.get('autocert') === '1';

  const { session, loginStatus, loginError, start: startMobileLogin, reset: resetMobileLogin } = useMobileWalletLogin();
  const showMobileQR = loginStatus !== 'idle';

  const shouldAutoConnect = searchParams.get('from') === 'commonsource';

  const handleLoginClick = useCallback(() => {
    setHasStartedLogin(true);
    initializeWallet();
  }, [initializeWallet]);

  const handleResetLogin = useCallback(() => {
    setHasStartedLogin(false);
    setCertificateError(null);
    setIsCheckingCertificates(false);
    isFetchingRef.current = false;
    resetWalletState();
    resetMobileLogin();
  }, [resetWalletState, resetMobileLogin]);

  const checkUserCertificates = useCallback(async () => {
    if (!userWallet || !userPubKey) return;
    if (isFetchingRef.current) return; // prevent double-fire (StrictMode / re-render races)

    isFetchingRef.current = true;
    setIsCheckingCertificates(true);
    setCertificateError(null);

    try {
      const certificates = await userWallet.listCertificates({
        certifiers: [MYCELIA_CERTIFIER_KEY],
        types: [Utils.toBase64(Utils.toArray(MYCELIA_CERT_TYPE))],
        limit: 1,
      });

      if (certificates.certificates.length === 0) {
        navigate('/create-account');
        return;
      }

      const certificate = certificates.certificates[0];
      const userData = await getDataFromWallet(userWallet, certificate);

      if (!userData) {
        setCertificateError('Unable to retrieve wallet profile data. Please try again.');
        return;
      }

      const nonce = await createNonce(userWallet, BACKEND_PUBLIC_KEY);

      const success = await walletLogin(userPubKey, certificate, userData, nonce);

      if (success) {
        navigate('/leaderboard');
      } else {
        setCertificateError('Authentication failed. Please try again.');
      }

    } catch (error: any) {
      console.error('Certificate check failed:', error);
      setCertificateError('Unable to check certificates. Please approve the request in your wallet.');
    } finally {
      setIsCheckingCertificates(false);
      isFetchingRef.current = false;
    }
  }, [userWallet, userPubKey, walletLogin, navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/leaderboard');
    }
  }, [isAuthenticated, navigate]);

  // Auto-connect if coming from CommonSource app or just created an account
  useEffect(() => {
    if ((shouldAutoConnect || comingFromAccountCreation) && !hasStartedLogin) {
      if (comingFromAccountCreation && userWallet && userPubKey) {
        // Wallet already connected — skip initializeWallet, go straight to cert check
        setHasStartedLogin(true);
      } else {
        handleLoginClick();
      }
    }
  }, [shouldAutoConnect, comingFromAccountCreation, hasStartedLogin, userWallet, userPubKey, handleLoginClick]);

  // Check certificates once wallet is connected
  useEffect(() => {
    if (userWallet && userPubKey && hasStartedLogin) {
      checkUserCertificates();
    }
  }, [userWallet, userPubKey, hasStartedLogin, checkUserCertificates]);

  // Navigate on successful mobile login
  useEffect(() => {
    if (loginStatus === 'done') navigate('/leaderboard');
  }, [loginStatus, navigate]);

  // Navigate to account creation if mobile wallet has no Mycelia cert
  useEffect(() => {
    if (loginStatus === 'error' && loginError === 'NO_CERTIFICATE') {
      navigate('/create-account');
    }
  }, [loginStatus, loginError, navigate]);

  // Mobile QR — scanning (QR code displayed)
  if (loginStatus === 'scanning' || loginStatus === 'authenticating') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {loginStatus === 'authenticating' ? 'Verifying mobile wallet…' : 'Scan with your mobile wallet'}
          </h1>
          <p className="text-gray-600 mb-6 text-sm">
            {loginStatus === 'authenticating'
              ? 'Retrieving your identity and certificates from the mobile wallet'
              : 'Open BSV Browser on your phone, go to Connections → Scan QR Code'}
          </p>
          {session?.qrDataUrl && loginStatus === 'scanning' ? (
            <div className="flex flex-col items-center gap-4">
              <img
                src={session.qrDataUrl}
                alt="Scan to connect mobile wallet"
                className="w-64 h-64 rounded-xl border border-gray-200 shadow-sm mx-auto"
              />
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                session.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {session.status === 'connected' ? 'Connected' : 'Waiting for scan…'}
              </span>
            </div>
          ) : (
            <div className="w-64 h-64 bg-gray-100 rounded-xl animate-pulse mx-auto" />
          )}
          {loginStatus === 'authenticating' && (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mt-6" />
          )}
          <Button variant="outline" onClick={resetMobileLogin} className="mt-6">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Mobile QR — error state
  if (loginStatus === 'error' && loginError && loginError !== 'NO_CERTIFICATE') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertDescription>{loginError}</AlertDescription>
          </Alert>
          <Button onClick={startMobileLogin} className="mt-4 w-full bg-green-600 hover:bg-green-700">
            Try Again
          </Button>
          <Button variant="outline" onClick={resetMobileLogin} className="mt-2 w-full">
            Back
          </Button>
        </div>
      </div>
    );
  }

  // Show error state if max retries exceeded
  if (maxRetriesExceeded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertDescription>
              Unable to connect to wallet. Please ensure your wallet is unlocked and try again.
            </AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()} className="mt-4 w-full">
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  // Show certificate error with retry
  if (certificateError && hasStartedLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertDescription>{certificateError}</AlertDescription>
          </Alert>
          <Button
            onClick={checkUserCertificates}
            disabled={isCheckingCertificates}
            className="mt-4 w-full bg-green-600 hover:bg-green-700"
          >
            {isCheckingCertificates ? 'Checking...' : 'Try Again'}
          </Button>
        </div>
      </div>
    );
  }

  // Show connecting state
  if (hasStartedLogin && isConnecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Connecting to your wallet...
          </h1>
          <p className="text-gray-600 mb-8">
            Please approve the connection request in your wallet
          </p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          {retryCount > 0 && (
            <p className="text-gray-500 text-sm mt-4">
              Retry attempt {retryCount}...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show checking certificates state
  if (hasStartedLogin && isCheckingCertificates) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Verifying your certificate...
          </h1>
          <p className="text-gray-600 mb-8">
            Checking your Brixit identity certificate
          </p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Default: Show welcome screen with login button (modal overlays it when needed)
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-3xl">B</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to BRIX
          </h1>
          <p className="text-xl text-gray-600">
            Track and share bionutrient scores from around the world
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Join BRIX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">Track Brix Levels</h3>
                <p className="text-sm text-gray-600">
                  Submit and view bionutrient scores from farms and stores worldwide
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Wallet className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">Secure Identity</h3>
                <p className="text-sm text-gray-600">
                  Login securely using your CommonSource wallet and certificate
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">Privacy First</h3>
                <p className="text-sm text-gray-600">
                  Your data is protected by blockchain-based authentication
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <Button
                onClick={handleLoginClick}
                disabled={isConnecting}
                className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
              >
                <Wallet className="w-5 h-5 mr-2" />
                Login with Desktop Wallet
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <Button
                variant="outline"
                onClick={startMobileLogin}
                className="w-full text-base py-5"
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Connect via Mobile QR
              </Button>
            </div>

            <p className="text-center text-sm text-gray-600">
              New to BRIX?{' '}
              <button
                type="button"
                onClick={handleLoginClick}
                className="text-green-600 hover:text-green-700 underline"
              >
                Connect your wallet to create an account
              </button>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500">
          Secured by BSV Blockchain
        </p>
      </div>
    </div>
  );
}
