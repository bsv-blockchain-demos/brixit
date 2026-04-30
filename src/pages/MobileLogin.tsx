import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { BrixLogo } from '@/components/common/BrixLogo';
import { Button } from '@/components/ui/button';
import { useMobileWalletLogin } from '@/hooks/useMobileWalletLogin';
import { ArrowLeft } from 'lucide-react';

export default function MobileLogin() {
  const navigate = useNavigate();
  const { session, loginStatus, loginError, start, reset, cancelSession } = useMobileWalletLogin();

  // Track whether auth completed so we don't tear down the relay session the
  // next page (CreateAccount / Leaderboard) still needs.
  const authCompletedRef = useRef(false);

  useEffect(() => {
    start();
    return () => {
      reset();
      if (!authCompletedRef.current) cancelSession();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loginStatus === 'done') {
      authCompletedRef.current = true;
      navigate('/leaderboard');
    }
  }, [loginStatus, navigate]);

  useEffect(() => {
    if (loginStatus === 'error' && loginError === 'NO_CERTIFICATE') {
      authCompletedRef.current = true;
      navigate('/create-account');
    }
  }, [loginStatus, loginError, navigate]);

  const isAuthenticating = loginStatus === 'authenticating';
  const isError = loginStatus === 'error' && loginError !== 'NO_CERTIFICATE';
  const isConnected = session?.status === 'connected';

  return (
    <AuthBackground>
      <div className="w-full max-w-3xl px-5 py-10">

        <div className="flex justify-start mb-10">
          <BrixLogo height="2.75rem" color="white" />
        </div>

        <div className="grid desktop:grid-cols-2 gap-10 desktop:gap-16 items-center">

          {/* Left: explanation */}
          <div>
            <h1
              className="font-landing font-medium text-white leading-tight mb-2"
              style={{ fontSize: 'clamp(1.6rem, 5vw, 2.25rem)' }}
            >
              Connect with Mycelia
            </h1>
            <p className="text-on-bg-body mb-8 leading-relaxed">
              Mycelia is the app that holds your secure identity. No passwords — just your phone.
            </p>

            <ol className="space-y-5">
              {[
                { n: '1', text: <>Download the <strong className="text-white font-medium">Mycelia app</strong> on your phone if you haven't already.</> },
                { n: '2', text: <>Open Mycelia, tap <strong className="text-white font-medium">Scan QR</strong>, and point your camera at the code.</> },
                { n: '3', text: <>Approve the connection request — you're in.</> },
              ].map(({ n, text }) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 text-white text-xs flex items-center justify-center font-semibold mt-0.5">
                    {n}
                  </span>
                  <p className="text-sm text-on-bg-body leading-relaxed">{text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-xs text-on-bg-muted mb-2">Don't have Mycelia yet?</p>
              <a
                href="#"
                className="text-sm font-medium text-white underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                Install for free
              </a>
            </div>

            <button
              onClick={() => { reset(); navigate('/login'); }}
              className="mt-8 flex items-center gap-1.5 text-sm text-on-bg-muted hover:text-on-bg-body transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to home
            </button>
          </div>

          {/* Right: QR / status */}
          <div className="flex flex-col items-center gap-4">
            {isError ? (
              <div className="text-center space-y-4 w-full max-w-xs">
                <p className="text-white font-medium">Connection failed</p>
                <p className="text-sm text-on-bg-body">{loginError}</p>
                <Button
                  onClick={() => { reset(); start(); }}
                  className="w-full bg-action-primary hover:bg-action-primary-hover text-white"
                >
                  Try again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { reset(); navigate('/login'); }}
                  className="w-full border-white/20 bg-transparent text-on-bg-body hover:bg-white/5"
                >
                  Back to home
                </Button>
              </div>
            ) : isAuthenticating ? (
              <div className="flex flex-col items-center gap-5 py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
                <div className="text-center">
                  <p className="text-white font-medium">Verifying your identity</p>
                  <p className="text-sm text-on-bg-body mt-1">Retrieving your credentials from Mycelia</p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white p-3 rounded-2xl shadow-xl">
                  {session?.qrDataUrl ? (
                    <img
                      src={session.qrDataUrl}
                      alt="Scan this code with the Mycelia app"
                      className="w-52 h-52 desktop:w-60 desktop:h-60 block rounded-lg"
                    />
                  ) : (
                    <div className="w-52 h-52 desktop:w-60 desktop:h-60 rounded-lg bg-muted animate-pulse" />
                  )}
                </div>

                <span className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isConnected
                    ? 'bg-green-fresh/20 text-green-light'
                    : 'bg-white/10 text-on-bg-body'
                }`}>
                  {isConnected ? 'Connected — verifying...' : 'Waiting for Mycelia scan…'}
                </span>
              </>
            )}
          </div>

        </div>
      </div>
    </AuthBackground>
  );
}
