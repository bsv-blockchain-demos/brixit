import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { Utils } from '@bsv/sdk';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Lock, TrendingUp } from 'lucide-react';
import { getDataFromWallet } from '@/utils/getDataFromWallet';

const COMMONSOURCE_SERVER_KEY = import.meta.env.VITE_COMMONSOURCE_SERVER_KEY;
const CERT_TYPE = import.meta.env.VITE_CERT_TYPE || 'CommonSource identity';
const EXTERNAL_ONBOARDING_URL = import.meta.env.VITE_EXTERNAL_ONBOARDING_URL;

export default function WalletLogin() {
  const [searchParams] = useSearchParams();
  const { userWallet, userPubKey, isConnecting, maxRetriesExceeded, retryCount, initializeWallet } = useWallet();
  const { walletLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [isCheckingCertificates, setIsCheckingCertificates] = useState(false);
  const [hasStartedLogin, setHasStartedLogin] = useState(false);

  // Check if we should auto-connect (from CommonSource app)
  const shouldAutoConnect = searchParams.get('from') === 'commonsource';

  const handleLoginClick = useCallback(() => {
    setHasStartedLogin(true);
    initializeWallet();
  }, [initializeWallet]);

  const checkUserCertificates = useCallback(async () => {
    if (!userWallet || !userPubKey) return;

    setIsCheckingCertificates(true);
    setCertificateError(null);

    const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

    try {
      const certificates = await userWallet.listCertificates({
        certifiers: [COMMONSOURCE_SERVER_KEY],
        types: [Utils.toBase64(Utils.toArray(CERT_TYPE))],
        limit: 1,
      });

      if (certificates.certificates.length === 0) {
        window.location.href = EXTERNAL_ONBOARDING_URL;
        return;
      }

      const certificate = certificates.certificates[0];
      const userData = await getDataFromWallet(userWallet);

      if (!userData) {
        setCertificateError('Unable to retrieve wallet profile data. Please ensure your profile is set up in CommonSource.');
        return;
      }

      const success = await walletLogin(userPubKey, certificate, userData);

      if (success) {
        console.log('Wallet login successful, navigating to leaderboard');
        navigate('/leaderboard');
      } else {
        setCertificateError('Authentication failed. Please try again.');
      }

    } catch (error: any) {
      console.error('Certificate check failed:', error);
      setCertificateError('Unable to check certificates. Please approve the request in your wallet.');
    } finally {
      setIsCheckingCertificates(false);
    }
  }, [userWallet, userPubKey, walletLogin, navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/leaderboard');
    }
  }, [isAuthenticated, navigate]);

  // Auto-connect if coming from CommonSource app
  useEffect(() => {
    if (shouldAutoConnect && !hasStartedLogin) {
      handleLoginClick();
    }
  }, [shouldAutoConnect, hasStartedLogin, handleLoginClick]);

  // Check certificates once wallet is connected
  useEffect(() => {
    if (userWallet && userPubKey && hasStartedLogin) {
      checkUserCertificates();
    }
  }, [userWallet, userPubKey, hasStartedLogin, checkUserCertificates]);

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
            Checking your CommonSource identity
          </p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Default: Show welcome screen with login button
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

            <div className="pt-4">
              <Button
                onClick={handleLoginClick}
                disabled={isConnecting}
                className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
              >
                <Wallet className="w-5 h-5 mr-2" />
                Login with CommonSource Wallet
              </Button>
            </div>

            <p className="text-center text-sm text-gray-600">
              Don't have a CommonSource wallet?{' '}
              <a
                href={EXTERNAL_ONBOARDING_URL}
                className="text-green-600 hover:text-green-700 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get started here
              </a>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500">
          Powered by CommonSource Network • Secured by BSV Blockchain
        </p>
      </div>
    </div>
  );
}
