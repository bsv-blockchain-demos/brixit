import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { BrixLogo } from '@/components/common/BrixLogo';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMobileWalletLogin } from '@/hooks/useMobileWalletLogin';
import { describeLoginError } from '@/lib/describeLoginError';
import { AlertCircle, ArrowLeft, ArrowUpRight, ChevronDown, RefreshCw, WifiOff } from 'lucide-react';

export default function MobileLogin() {
  const navigate = useNavigate();
  const { session, loginStatus, loginError, start, reset, cancelSession } = useMobileWalletLogin();

  // Track whether auth completed so we don't tear down the relay session the
  // next page (CreateAccount / Leaderboard) still needs.
  const authCompletedRef = useRef(false);

  useEffect(() => {
    // setTimeout(0) prevents StrictMode double-fire: cleanup cancels the timer
    // before it fires, so createSession() is only called once per real mount.
    const timer = setTimeout(() => start(), 0);
    return () => {
      clearTimeout(timer);
      reset();
      if (!authCompletedRef.current) cancelSession();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loginStatus === 'done') {
      authCompletedRef.current = true;
      navigate('/map');
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
  const errorCopy = describeLoginError(loginError);
  const ErrorIcon = errorCopy.offline ? WifiOff : AlertCircle;

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
              Mycelia is the app that holds your secure identity. No passwords, just your phone.
            </p>

            {/* Solid card, not translucent-on-photo: these are the steps a
                first-time user must actually follow, so they get the same
                "score card on dark background" treatment as the rest of the
                app — opaque surface, dark text, guaranteed contrast in both
                themes, instead of low-opacity white over a busy backdrop. */}
            <ol className="space-y-4 rounded-2xl bg-card border border-hairline shadow-lg p-5">
              {[
                { n: '1', text: <>Download the <strong className="text-text-dark font-semibold">Mycelia app</strong> on your phone if you haven't already.</> },
                { n: '2', text: <>Open Mycelia, tap <strong className="text-text-dark font-semibold">Scan QR</strong>, and point your camera at the code.</> },
                { n: '3', text: <>Approve the connection request, and you're in.</> },
              ].map(({ n, text }) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-green-mid text-white text-xs flex items-center justify-center font-semibold mt-0.5">
                    {n}
                  </span>
                  <p className="text-sm text-text-mid leading-relaxed">{text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-sm text-on-bg-body mb-3">Don't have Mycelia yet?</p>
              <a
                href="https://mycelia.life"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-card py-1.5 pl-1.5 pr-5 shadow-lg ring-1 ring-white/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {/* Sheen sweep: decorative, disabled for reduced motion */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent motion-safe:animate-sheen motion-reduce:hidden"
                />
                <img src="/logos/mycelia-icon.svg" alt="" className="relative h-9 w-9 rounded-full shadow-sm" />
                <span className="relative flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-text-dark">Install Mycelia</span>
                  <span className="text-xs text-text-mid">It's free · mycelia.life</span>
                </span>
                <ArrowUpRight
                  className="relative w-4 h-4 text-text-mid transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>

            <button
              onClick={() => { reset(); navigate('/'); }}
              className="mt-8 flex items-center gap-1.5 text-sm text-on-bg-muted hover:text-on-bg-body transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to home
            </button>
          </div>

          {/* Right: QR / status */}
          <div className="flex flex-col items-center gap-4">
            {isError ? (
              <div
                role="alert"
                className="w-full max-w-sm rounded-2xl bg-card border border-hairline shadow-lg p-6"
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-10 h-10 rounded-xl bg-warning-bg flex items-center justify-center">
                    <ErrorIcon className="w-5 h-5 text-warning" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold text-text-dark leading-snug">{errorCopy.title}</p>
                    <p className="text-sm text-text-mid mt-1 leading-relaxed">{errorCopy.description}</p>
                  </div>
                </div>

                <ul className="mt-5 space-y-2">
                  {errorCopy.tips.map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-text-mid leading-relaxed">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-text-muted shrink-0" aria-hidden="true" />
                      {tip}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 space-y-2">
                  <Button
                    onClick={() => { reset(); start(); }}
                    className="w-full bg-action-primary hover:bg-action-primary-hover text-white"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                    Try again
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { reset(); navigate('/'); }}
                    className="w-full text-text-mid"
                  >
                    Back to home
                  </Button>
                </div>

                {loginError && (
                  <Collapsible className="mt-4 pt-4 border-t border-hairline">
                    <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-text-muted hover:text-text-mid transition-colors">
                      Technical details
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <code className="mt-2 block rounded-md bg-muted px-2 py-1.5 text-xs text-text-mid break-words">
                        {loginError}
                      </code>
                    </CollapsibleContent>
                  </Collapsible>
                )}
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

                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-white transition-colors ${
                  isConnected ? 'bg-green-mid/70' : 'bg-white/10'
                }`}>
                  {isConnected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-light shrink-0" aria-hidden="true" />
                  )}
                  {isConnected ? 'Connected, verifying...' : 'Waiting for Mycelia scan…'}
                </span>
              </>
            )}
          </div>

        </div>
      </div>
    </AuthBackground>
  );
}
