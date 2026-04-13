import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { Utils, createNonce } from '@bsv/sdk';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Lock, TrendingUp, Smartphone, HelpCircle } from 'lucide-react';
import { getDataFromWallet } from '@/utils/getDataFromWallet';
import { useMobileWalletLogin } from '@/hooks/useMobileWalletLogin';
import { useIsMobile } from '@/hooks/use-mobile';
import { AuthBackground } from '@/components/ui/AuthBackground';

const MYCELIA_CERT_TYPE = import.meta.env.VITE_CERT_TYPE || 'Brixit Identity';
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
  // qr=1 means we arrived from the wallet error page — auto-start mobile QR
  const shouldStartMobileQR = searchParams.get('qr') === '1';

  const { session, loginStatus, loginError, start: startMobileLogin, reset: resetMobileLogin } = useMobileWalletLogin();
  const isMobile = useIsMobile();
  const showMobileQR = loginStatus !== 'idle';

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
        types: [Utils.toBase64(Utils.toArray(MYCELIA_CERT_TYPE, 'utf8'))],
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

  // Auto-connect after account creation (wallet already initialised — skip to cert check)
  useEffect(() => {
    if (comingFromAccountCreation && !hasStartedLogin) {
      if (userWallet && userPubKey) {
        setHasStartedLogin(true);
      } else {
        handleLoginClick();
      }
    }
  }, [comingFromAccountCreation, hasStartedLogin, userWallet, userPubKey, handleLoginClick]);

  // Check certificates once wallet is connected
  useEffect(() => {
    if (userWallet && userPubKey && hasStartedLogin) {
      checkUserCertificates();
    }
  }, [userWallet, userPubKey, hasStartedLogin, checkUserCertificates]);

  // Auto-start mobile QR when arriving from the wallet error page
  useEffect(() => {
    if (shouldStartMobileQR && loginStatus === 'idle') {
      resetWalletState();
      startMobileLogin();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const pageShell = (children: React.ReactNode) => (
    <AuthBackground>
      <div className="max-w-sm w-full">
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mx-auto shadow-lg">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
        </div>
        {children}
      </div>
    </AuthBackground>
  );

  // Mobile QR — scanning (QR code displayed, desktop only)
  if (loginStatus === 'scanning' || loginStatus === 'authenticating') {
    return (
      <AuthBackground>
        <div className="w-full max-w-2xl">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mx-auto shadow-lg">
              <span className="text-white font-bold text-2xl">B</span>
            </div>
          </div>
          <div className="flex gap-4 items-stretch">
            {/* QR card */}
            <Card className="flex-1">
              <CardHeader className="pb-2 text-center">
                <CardTitle>
                  {loginStatus === 'authenticating' ? 'Verifying…' : 'Scan with your mobile wallet'}
                </CardTitle>
                <CardDescription>
                  {loginStatus === 'authenticating'
                    ? 'Retrieving your identity and certificates'
                    : 'Open the Mycelia app on your phone and scan this code'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {session?.qrDataUrl && loginStatus === 'scanning' ? (
                  <>
                    <img
                      src={session.qrDataUrl}
                      alt="Scan to connect mobile wallet"
                      className="w-56 h-56 rounded-xl border border-gray-200 shadow-sm"
                    />
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      session.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {session.status === 'connected' ? 'Connected' : 'Waiting for scan…'}
                    </span>
                  </>
                ) : (
                  <div className="w-56 h-56 bg-gray-100 rounded-xl animate-pulse" />
                )}
                {loginStatus === 'authenticating' && (
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-green-600" />
                )}
                <Button variant="outline" onClick={resetMobileLogin} className="w-full mt-2">
                  Cancel
                </Button>
              </CardContent>
            </Card>

            {/* Instructions card */}
            <Card className="w-64 shrink-0 bg-green-50 border-green-200 self-start">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-800">How to connect</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-green-900">
                <p>Scan the QR with your camera, or open the Mycelia app, go to the <strong>Connections</strong> tab and scan from there.</p>
                <p>Once connected, any action requests will pop up on your mobile device.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </AuthBackground>
    );
  }

  // Mobile QR — error state
  if (loginStatus === 'error' && loginError && loginError !== 'NO_CERTIFICATE') {
    return pageShell(
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Connection failed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert variant="destructive">
            <AlertDescription>{loginError}</AlertDescription>
          </Alert>
          <Button onClick={startMobileLogin} className="w-full bg-green-600 hover:bg-green-700">
            Try Again
          </Button>
          <Button variant="outline" onClick={resetMobileLogin} className="w-full">
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show error state if max retries exceeded
  if (maxRetriesExceeded) {
    return pageShell(
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Couldn't connect to your wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert variant="destructive">
            <AlertDescription>
              Unable to connect to wallet. Please ensure your wallet is unlocked and try again.
            </AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()} className="w-full bg-green-600 hover:bg-green-700">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show certificate error with retry
  if (certificateError && hasStartedLogin) {
    return pageShell(
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Certificate check failed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert variant="destructive">
            <AlertDescription>{certificateError}</AlertDescription>
          </Alert>
          <Button
            onClick={checkUserCertificates}
            disabled={isCheckingCertificates}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isCheckingCertificates ? 'Checking…' : 'Try Again'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show connecting state
  if (hasStartedLogin && isConnecting) {
    return pageShell(
      <Card>
        <CardContent className="pt-6 pb-6 text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
          <p className="font-semibold text-gray-800">Connecting to your wallet…</p>
          <p className="text-sm text-gray-500">Please approve the connection request</p>
          {retryCount > 0 && (
            <p className="text-xs text-gray-400">Retry attempt {retryCount}…</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show checking certificates state
  if (hasStartedLogin && isCheckingCertificates) {
    return pageShell(
      <Card>
        <CardContent className="pt-6 pb-6 text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
          <p className="font-semibold text-gray-800">Verifying your certificate…</p>
          <p className="text-sm text-gray-500">Checking your Brixit identity</p>
        </CardContent>
      </Card>
    );
  }

  // Default: Show welcome screen with login button (modal overlays it when needed)
  return (
    <AuthBackground>
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
            <div className="relative flex items-center justify-center">
              <CardTitle className="text-2xl">Join BRIX</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/help')}
                className="absolute right-0 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs"
              >
                <HelpCircle className="w-4 h-4" />
                How it works
              </Button>
            </div>
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
                  Login securely using your BSV wallet and Mycelia certificate
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
                className="w-full bg-green-600 hover:bg-green-700 h-auto py-4 flex flex-col items-center gap-1"
              >
                <span className="flex items-center gap-2 text-lg">
                  <Wallet className="w-5 h-5" />
                  Get Started
                </span>
                <span className="text-xs font-normal opacity-80">Securely sign in with your device</span>
              </Button>

              {!isMobile && (
                <Button
                  variant="outline"
                  onClick={startMobileLogin}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  Connect via mobile QR
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500">
          Secured by BSV Blockchain
        </p>
      </div>
    </AuthBackground>
  );
}
