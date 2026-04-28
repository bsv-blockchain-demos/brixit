import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { Utils, createNonce } from '@bsv/sdk';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Smartphone, ArrowRight, ShieldCheck, KeyRound, MonitorSmartphone } from 'lucide-react';
import { getDataFromWallet } from '@/utils/getDataFromWallet';
import { useMobileWalletLogin } from '@/hooks/useMobileWalletLogin';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, useReducedMotion } from 'framer-motion';
import { getMapboxToken } from '@/lib/getMapboxToken';
import { apiGet } from '@/lib/api';
import { scoreBrix } from '@/lib/getBrixColor';

const MYCELIA_CERT_TYPE = import.meta.env.VITE_CERT_TYPE || 'Brixit Identity';
const MYCELIA_CERTIFIER_KEY = import.meta.env.VITE_SERVER_PUBLIC_KEY;
const BACKEND_PUBLIC_KEY = import.meta.env.VITE_SERVER_PUBLIC_KEY;

interface ClusterSample {
  brixValue: number;
  cropLabel: string;
  cropVariety: string | null;
  venueName: string | null;
  venueCity: string | null;
  poorBrix: number | null;
  excellentBrix: number | null;
}
interface MapCluster { lat: number; lng: number; count: number; sample?: ClusterSample; }
interface MapPreview {
  url: string;
  clusters: MapCluster[];
  center: { lat: number; lng: number };
  zoom: number;
}

// Web Mercator: returns position as % of the 560×380 static image
function toImagePct(
  lat: number, lng: number,
  centerLat: number, centerLng: number,
  zoom: number,
): { x: number; y: number } {
  const S = 256 * Math.pow(2, zoom);
  const wx = (l: number) => (l + 180) / 360 * S;
  const wy = (l: number) => {
    const r = l * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * S;
  };
  return {
    x: Math.max(8, Math.min(92, (wx(lng) - wx(centerLng)) / 560 * 100 + 50)),
    y: Math.max(8, Math.min(92, (wy(lat) - wy(centerLat)) / 380 * 100 + 50)),
  };
}

// ── Stat column (hero strip) ─────────────────────────────────────
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center border-l border-white/10 first:border-l-0 px-4">
      <p className="font-display text-2xl desktop:text-3xl font-bold text-white">{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

// ── Community feed card ──────────────────────────────────────────
function FeedCard({ product, location, pct, score, user, rating }: { product: string; location: string; pct: string; score: number; user: string; rating: 'Excellent' | 'Good' | 'Poor' }) {
  const color = rating === 'Excellent' ? 'var(--green-mid)' : rating === 'Good' ? 'var(--gold)' : 'var(--score-poor)';
  return (
    <Card className="overflow-hidden border" style={{ borderColor: 'var(--blue-pale)' }}>
      <CardContent className="p-5">
        <p className="font-display font-bold text-4xl leading-none" style={{ color }} aria-label={`Score ${pct}, rated ${rating}`}>{pct}</p>
        <p className="text-xs font-medium mt-1" style={{ color }}>{rating}</p>
        <p className="font-semibold mt-4" style={{ color: 'var(--text-dark)' }}>{product}</p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{location} · {user} · {score} BRIX</p>
      </CardContent>
    </Card>
  );
}

export default function WalletLogin() {
  const [searchParams] = useSearchParams();
  const { userWallet, userPubKey, isConnecting, maxRetriesExceeded, retryCount, initializeWallet, resetWalletState } = useWallet();
  const { walletLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [isCheckingCertificates, setIsCheckingCertificates] = useState(false);
  const [hasStartedLogin, setHasStartedLogin] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [mapPreview, setMapPreview] = useState<MapPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    const FALLBACK: Omit<MapPreview, 'url'> = {
      center: { lat: 47.5, lng: 8.0 },
      zoom: 3,
      clusters: [
        { lat: 47.5, lng: 8.0, count: 8 },   // Switzerland / Central Europe
        { lat: 48.8, lng: 2.3, count: 5 },   // Paris / France
        { lat: 41.9, lng: 12.5, count: 3 },  // Rome / Italy
      ],
    };
    const buildUrl = (token: string, d: Omit<MapPreview, 'url'>) =>
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${d.center.lng.toFixed(4)},${d.center.lat.toFixed(4)},${d.zoom},0/560x380@2x?access_token=${token}`;

    getMapboxToken().then(token => {
      if (!token) { console.warn('[map-preview] No Mapbox token'); return; }
      if (cancelled) return;
      console.log('[map-preview] Using fallback, fetching live data…');
      setMapPreview({ ...FALLBACK, url: buildUrl(token, FALLBACK) });
      apiGet<{ clusters: MapCluster[]; center: { lat: number; lng: number }; zoom: number }>('/api/map-preview')
        .then(data => {
          console.log('[map-preview] Data received:', data);
          if (cancelled) return;
          if (!data?.clusters?.length) { console.warn('[map-preview] No clusters in response, staying on fallback'); return; }
          const live = { ...data, zoom: 3 };
          setMapPreview({ ...live, url: buildUrl(token, live) });
          console.log('[map-preview] Upgraded to live data, clusters:', live.clusters.length);
        })
        .catch(err => { console.error('[map-preview] API error:', err); });
    }).catch(err => { console.error('[map-preview] getMapboxToken error:', err); });
    return () => { cancelled = true; };
  }, []);
  const isFetchingRef = useRef(false);
  const hasAttemptedRef = useRef(false);

  const comingFromAccountCreation = searchParams.get('autocert') === '1';
  const shouldStartMobileQR = searchParams.get('qr') === '1';

  const { session, loginStatus, loginError, start: startMobileLogin, reset: resetMobileLogin } = useMobileWalletLogin();
  const isMobile = useIsMobile();
  const showMobileQR = loginStatus !== 'idle';
  const prefersReducedMotion = useReducedMotion();

  // ── Auth handlers (unchanged) ──────────────────────────────────

  const handleLoginClick = useCallback(() => {
    setHasStartedLogin(true);
    setAuthDialogOpen(true);
    initializeWallet();
  }, [initializeWallet]);

  const handleMobileLoginClick = useCallback(() => {
    setAuthDialogOpen(true);
    startMobileLogin();
  }, [startMobileLogin]);

  const handleResetLogin = useCallback(() => {
    setHasStartedLogin(false);
    setCertificateError(null);
    setIsCheckingCertificates(false);
    isFetchingRef.current = false;
    hasAttemptedRef.current = false;
    setAuthDialogOpen(false);
    resetWalletState();
    resetMobileLogin();
  }, [resetWalletState, resetMobileLogin]);

  const checkUserCertificates = useCallback(async () => {
    if (!userWallet || !userPubKey) return;
    if (isFetchingRef.current) return;

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
      const result = await walletLogin(userPubKey, certificate, userData, nonce);

      if (result.success) {
        navigate('/leaderboard');
      } else {
        setCertificateError(result.error || 'Authentication failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Certificate check failed:', error);
      const msg = error?.message || String(error);
      // Surface backend messages (e.g. rate-limit) instead of a generic fallback
      setCertificateError(msg || 'Unable to check certificates. Please approve the request in your wallet.');
    } finally {
      setIsCheckingCertificates(false);
      isFetchingRef.current = false;
    }
  }, [userWallet, userPubKey, walletLogin, navigate]);

  // ── Effects (unchanged) ────────────────────────────────────────

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/leaderboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (comingFromAccountCreation && !hasStartedLogin) {
      setAuthDialogOpen(true);
      if (userWallet && userPubKey) {
        setHasStartedLogin(true);
      } else {
        handleLoginClick();
      }
    }
  }, [comingFromAccountCreation, hasStartedLogin, userWallet, userPubKey, handleLoginClick]);

  useEffect(() => {
    if (userWallet && userPubKey && hasStartedLogin && !hasAttemptedRef.current) {
      hasAttemptedRef.current = true;
      checkUserCertificates();
    }
  }, [userWallet, userPubKey, hasStartedLogin, checkUserCertificates]);

  useEffect(() => {
    if (shouldStartMobileQR && loginStatus === 'idle') {
      resetWalletState();
      setAuthDialogOpen(true);
      startMobileLogin();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loginStatus === 'done') navigate('/leaderboard');
  }, [loginStatus, navigate]);

  useEffect(() => {
    if (loginStatus === 'error' && loginError === 'NO_CERTIFICATE') {
      navigate('/create-account');
    }
  }, [loginStatus, loginError, navigate]);

  // ── Auth dialog content ────────────────────────────────────────

  const isQRScanning = loginStatus === 'scanning' || loginStatus === 'authenticating';
  const isAuthActive = hasStartedLogin || showMobileQR;

  function renderAuthState() {
    // QR scanning / authenticating
    if (isQRScanning) {
      return (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display">
              {loginStatus === 'authenticating' ? 'Verifying...' : 'Scan with your mobile wallet'}
            </DialogTitle>
            <DialogDescription>
              {loginStatus === 'authenticating'
                ? 'Retrieving your identity and certificates'
                : 'Open the wallet app on your phone and scan this code'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {session?.qrDataUrl && loginStatus === 'scanning' ? (
              <>
                <img
                  src={session.qrDataUrl}
                  alt="Scan to connect mobile wallet"
                  className="w-56 h-56 rounded-xl border border-border shadow-sm"
                />
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  session.status === 'connected' ? 'bg-secondary text-green-fresh' : 'bg-amber-50 text-amber-700'
                }`}>
                  {session.status === 'connected' ? 'Connected' : 'Waiting for scan...'}
                </span>
              </>
            ) : (
              <div className="w-56 h-56 bg-muted rounded-xl animate-pulse" />
            )}
            {loginStatus === 'authenticating' && (
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
            )}
            <Button variant="outline" onClick={handleResetLogin} className="w-full mt-2">
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    // Mobile QR error
    if (loginStatus === 'error' && loginError && loginError !== 'NO_CERTIFICATE') {
      return (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display">Connection failed</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertDescription>{loginError}</AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2">
            <Button onClick={() => { resetMobileLogin(); startMobileLogin(); }} className="w-full">
              Try Again
            </Button>
            <Button variant="outline" onClick={handleResetLogin} className="w-full">
              Back
            </Button>
          </div>
        </div>
      );
    }

    // Max retries exceeded
    if (maxRetriesExceeded) {
      return (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display">Couldn't connect</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertDescription>
              Unable to connect to your wallet. Please ensure it's unlocked and try again.
            </AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()} className="w-full">
            Retry
          </Button>
        </div>
      );
    }

    // Certificate error
    if (certificateError && hasStartedLogin) {
      return (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display">Verification failed</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertDescription>{certificateError}</AlertDescription>
          </Alert>
          <Button
            onClick={checkUserCertificates}
            disabled={isCheckingCertificates}
            className="w-full"
          >
            {isCheckingCertificates ? 'Checking...' : 'Try Again'}
          </Button>
        </div>
      );
    }

    // Connecting
    if (hasStartedLogin && isConnecting) {
      return (
        <div className="text-center space-y-4 py-4">
          <DialogTitle className="sr-only">Connecting to your wallet</DialogTitle>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <div>
            <p className="font-semibold text-foreground">Connecting to your wallet...</p>
            <p className="text-sm text-muted-foreground mt-1">Please approve the connection request</p>
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">Retry attempt {retryCount}...</p>
            )}
          </div>
        </div>
      );
    }

    // Checking certificates
    if (hasStartedLogin && isCheckingCertificates) {
      return (
        <div className="text-center space-y-4 py-4">
          <DialogTitle className="sr-only">Verifying your identity</DialogTitle>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <div>
            <p className="font-semibold text-foreground">Verifying your identity...</p>
            <p className="text-sm text-muted-foreground mt-1">Checking your credentials</p>
          </div>
        </div>
      );
    }

    return null;
  }

  // ── Motion helpers ─────────────────────────────────────────────

  const fadeUp = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.5 } };

  const stagger = prefersReducedMotion
    ? {}
    : { initial: 'hidden', whileInView: 'visible', viewport: { once: true, margin: '-60px' }, variants: { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } } };

  const staggerChild = prefersReducedMotion
    ? {}
    : { variants: { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } } };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-screen overflow-x-hidden">

        {/* ═══ Section 1: Hero ═══════════════════════════════════ */}
        <section
          className="relative flex items-center overflow-hidden"
          style={{ background: `radial-gradient(ellipse at 30% 20%, #244536 0%, var(--blue-deep) 70%)` }}
        >
          <div className="w-full max-w-6xl mx-auto px-5 py-20 desktop:py-28">
            {/* Content row */}
            <div className="grid desktop:grid-cols-2 gap-6 desktop:gap-16 items-start mb-8">

              {/* Left: copy */}
              <motion.div {...fadeUp}>
                <p className="uppercase tracking-[0.2em] text-sm font-medium mb-4" style={{ color: 'var(--text-muted)' }}>
                  Real food. Real nutrition.
                </p>
                <h1
                  className="font-display font-bold text-white leading-[1.12] mb-6"
                  style={{ fontSize: 'clamp(2.125rem, 9vw, 3.25rem)' }}
                >
                  Finally know if your food is{' '}
                  <em className="italic" style={{ color: 'var(--blue-light)' }}>actually</em>{' '}
                  nutritious.
                </h1>
                <p className="text-base desktop:text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  BRIX measures the nutrient density of fresh produce — so you can shop smarter, feed your family better, and share what you discover.
                </p>
              </motion.div>

              {/* Right: map preview */}
              <motion.div
                className="flex flex-col gap-2 mt-4 desktop:mt-0"
                {...(prefersReducedMotion ? {} : { initial: { opacity: 0, x: 40 }, whileInView: { opacity: 1, x: 0 }, viewport: { once: true }, transition: { duration: 0.6, delay: 0.2 } })}
              >
                <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Where people are testing their food
                </p>
                <div className="relative rounded-2xl overflow-hidden shadow-xl h-[200px] desktop:h-[260px]">
                  {mapPreview ? (
                    <>
                      <img
                        src={mapPreview.url}
                        alt="Map showing community BRIX score locations"
                        className="w-full h-full object-cover"
                        loading="eager"
                      />

                      {/* Cluster circles + score popup for the largest cluster */}
                      {(() => {
                        const { clusters, center, zoom } = mapPreview;
                        const largest = clusters[0];
                        const largestPct = toImagePct(largest.lat, largest.lng, center.lat, center.lng, zoom);

                        return (
                          <>
                            {/* All cluster circles */}
                            {clusters.map((c, i) => {
                              const pct = toImagePct(c.lat, c.lng, center.lat, center.lng, zoom);
                              const d = c.count >= 200 ? 80 : c.count >= 50 ? 60 : c.count >= 10 ? 44 : 32;
                              return (
                                <div
                                  key={i}
                                  className="absolute pointer-events-none flex items-center justify-center rounded-full font-bold text-white text-sm"
                                  style={{
                                    top: `${pct.y}%`, left: `${pct.x}%`,
                                    width: d, height: d,
                                    transform: 'translate(-50%, -50%)',
                                    backgroundColor: '#2d6a4f',
                                    border: '2px solid rgba(255,255,255,0.6)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                                    fontSize: d < 36 ? 11 : 13,
                                  }}
                                >
                                  {c.count}
                                </div>
                              );
                            })}

                            {/* Score popup on the largest cluster — arrow points down to it */}
                            {(() => {
                              const s = largest.sample;
                              const score = s ? scoreBrix(
                                s.brixValue,
                                s.poorBrix != null && s.excellentBrix != null
                                  ? { poor: s.poorBrix, average: null, good: null, excellent: s.excellentBrix }
                                  : null,
                              ) : null;
                              const displayPct  = score?.display ?? '88%';
                              const quality     = score?.quality ?? 'Excellent';
                              const scoreColor  = score?.hex     ?? 'var(--green-mid)';
                              const productName = s
                                ? (s.cropVariety ? `${s.cropVariety} ${s.cropLabel}` : s.cropLabel)
                                : 'Banana';
                              const location = s ? (s.venueName || s.venueCity || '') : 'Aldi · Zurich';
                              return (
                                <div
                                  className="absolute pointer-events-none"
                                  style={{
                                    bottom: `calc(${100 - largestPct.y}% + 20px)`,
                                    left: `${largestPct.x}%`,
                                    transform: 'translateX(-50%)',
                                  }}
                                >
                                  <div className="bg-white rounded-xl shadow-xl px-2 py-1.5 desktop:px-3 desktop:py-2.5 w-36 desktop:w-44 relative">
                                    <div className="flex items-baseline gap-1 mb-0.5">
                                      <span className="font-display font-bold text-base desktop:text-xl leading-none" style={{ color: scoreColor }}>
                                        {displayPct}
                                      </span>
                                      <span className="font-semibold uppercase tracking-wide" style={{ color: scoreColor, fontSize: '10px' }}>
                                        {quality}
                                      </span>
                                    </div>
                                    <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--text-dark)' }}>
                                      {productName}
                                    </p>
                                    {location && (
                                      <p className="text-xs leading-snug hidden desktop:block" style={{ color: 'var(--text-muted)' }}>
                                        {location}
                                      </p>
                                    )}
                                    <p className="leading-snug mt-1 pt-1 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--blue-pale)', fontSize: '10px' }}>
                                      {largest.count - 1} other submissions on this location
                                    </p>
                                    {/* Arrow tip pointing down toward the cluster circle */}
                                    <div
                                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45"
                                      style={{ boxShadow: '2px 2px 3px rgba(0,0,0,0.06)' }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="w-full h-full bg-white/5 animate-pulse" />
                  )}
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Verified scores from real growers and shoppers
                </p>
              </motion.div>
            </div>

            {/* Button row — same column grid + items-start guarantees equal top position */}
            <div className="grid desktop:grid-cols-2 gap-3 desktop:gap-16 mb-6 items-start">
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleLoginClick}
                  size="lg"
                  className="bg-green-fresh hover:bg-green-mid text-white h-auto py-4 px-7 text-base font-medium gap-2 rounded-xl w-full max-w-md"
                >
                  Start tracking my food
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Free &middot; No credit card &middot; Your data is yours
                </p>
              </div>
              <Button
                variant="outline"
                size="lg"
                className="w-full max-w-md h-auto py-4 px-7 text-base rounded-xl border-white/20 bg-transparent text-white/70 hover:text-white hover:bg-white/5"
                onClick={() => navigate('/map')}
              >
                Browse scores near me
              </Button>
            </div>

            {/* Stats strip */}
            <motion.div
              className="mt-16 desktop:mt-20 grid grid-cols-3 max-w-md desktop:max-w-xl mx-auto desktop:mx-0 border-t border-white/10 pt-8"
              {...(prefersReducedMotion ? {} : { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.5, delay: 0.35 } })}
            >
              <Stat value="14,280+" label="scores submitted" />
              <Stat value="342" label="farms tracked" />
              <Stat value="38" label="countries" />
            </motion.div>
          </div>
        </section>

        {/* ═══ Section 2: What is BRIX? ══════════════════════════ */}
        <section id="about" className="py-20 desktop:py-28" style={{ backgroundColor: 'var(--cream)' }}>
          <div className="max-w-5xl mx-auto px-5">
            <div className="grid desktop:grid-cols-2 gap-12 desktop:gap-16 items-start">
              {/* Left column — text */}
              <div>
                <motion.div className="mb-8" {...fadeUp}>
                  <p className="uppercase tracking-[0.2em] text-sm font-medium mb-3" style={{ color: 'var(--green-fresh)' }}>
                    What is a brix score?
                  </p>
                  <h2 className="font-display text-3xl desktop:text-4xl font-bold" style={{ color: 'var(--text-dark)' }}>
                    A number that tells you how{' '}
                    <em style={{ color: 'var(--green-fresh)' }}>good</em>{' '}
                    your food really is
                  </h2>
                </motion.div>

                <motion.div className="space-y-5" {...fadeUp}>
                  <p className="text-lg leading-relaxed" style={{ color: 'var(--text-mid)' }}>
                    The BRIX score measures dissolved solids in fresh produce — primarily sugars — along with small amounts of minerals, amino acids, and other compounds. Higher scores often indicate a plant that was photosynthesizing well and functioning efficiently, conditions commonly associated with better flavour and overall food quality.
                  </p>
                  <p className="text-lg leading-relaxed" style={{ color: 'var(--text-mid)' }}>
                    Supermarket carrots often score 4–6. A carrot from a well-managed farm can score 18. Same vegetable. Very different quality. Now you can know before you buy.
                  </p>
                </motion.div>
              </div>

              {/* Right column — score guide card */}
              <motion.div
                className="rounded-2xl p-6 desktop:p-8 shadow-sm"
                style={{ backgroundColor: 'hsl(var(--card))' }}
                {...fadeUp}
              >
                <p className="uppercase tracking-[0.15em] text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  Score Guide
                </p>
                <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                  Scores are relative to each crop's expected range — apples and bananas are judged by different standards.
                </p>

                <div className="space-y-6">
                  {[
                    { tier: 'Excellent', label: '75%+', color: 'var(--green-mid)',   desc: 'Well above the expected range for this crop.' },
                    { tier: 'Good',      label: '50%+', color: 'var(--green-fresh)', desc: 'Above the crop average. Better than most commercial produce.' },
                    { tier: 'Average',   label: '25%+', color: 'var(--gold)',         desc: 'Near the crop average. Typical of commercial growing.' },
                    { tier: 'Poor',      label: '<25%',  color: 'var(--score-poor)',  desc: 'Below the expected range. Low nutrient density for this crop.' },
                  ].map(({ tier, label, color, desc }) => (
                    <div key={tier} className="flex items-start gap-5">
                      <p className="text-3xl font-display font-bold shrink-0 w-16 tabular-nums" style={{ color }}>{label}</p>
                      <div className="flex-1">
                        <p className="font-semibold" style={{ color: 'var(--text-dark)' }}>{tier}</p>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-mid)' }}>{desc}</p>
                        <div className="h-0.5 w-12 mt-3 rounded-full" style={{ backgroundColor: color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══ Section 3: Community Scores ═══════════════════════ */}
        <section id="community" className="py-20 desktop:py-28" style={{ backgroundColor: 'var(--blue-mist)' }}>
          <div className="max-w-5xl mx-auto px-5">
            <motion.div className="mb-10" {...fadeUp}>
              <p className="uppercase tracking-[0.2em] text-sm font-medium mb-3" style={{ color: 'var(--green-fresh)' }}>
                Community
              </p>
              <h2 className="font-display text-3xl desktop:text-4xl font-bold" style={{ color: 'var(--text-dark)' }}>
                What people are finding
              </h2>
            </motion.div>

            <motion.div {...stagger} className="grid desktop:grid-cols-3 gap-5">
              <motion.div {...staggerChild}>
                <FeedCard product="Biodynamic Tomatoes" location="Hopp Farm · Basel" score={19.2} pct="88%" user="Sandra K." rating="Excellent" />
              </motion.div>
              <motion.div {...staggerChild}>
                <FeedCard product="Organic Apples" location="Migros Oerlikon" score={9.0} pct="54%" user="Marie R." rating="Good" />
              </motion.div>
              <motion.div {...staggerChild}>
                <FeedCard product="Baby Leaf Salad" location="Coop Geneva" score={4.5} pct="19%" user="Céline L." rating="Poor" />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══ Section 4: Mission ════════════════════════════════ */}
        <section className="py-24 desktop:py-32" style={{ background: `radial-gradient(ellipse at 70% 80%, #244536 0%, var(--blue-deep) 70%)` }}>
          <div className="max-w-2xl mx-auto px-5 text-center">
            <motion.div {...fadeUp}>
              <p className="uppercase tracking-[0.2em] text-sm font-medium mb-5" style={{ color: 'var(--green-fresh)' }}>
                Our Mission
              </p>
              <h2
                className="font-display font-bold text-white leading-tight mb-6"
                style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}
              >
                Every score you submit helps{' '}
                <em style={{ color: 'var(--blue-light)' }}>another family</em>{' '}
                eat better
              </h2>
              <p className="text-lg leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Good food knowledge shouldn't be locked away. When you share a score, you're not just helping yourself — you're changing what your whole community reaches for.
              </p>
              <Button
                onClick={handleLoginClick}
                size="lg"
                className="bg-green-fresh hover:bg-green-mid text-white h-auto py-4 px-10 text-base font-medium gap-2 rounded-xl"
              >
                Join 8,400 conscious shoppers
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
        </section>

        {/* ═══ Section 5: Sign Up ════════════════════════════════ */}
        <section className="py-20 desktop:py-28" style={{ backgroundColor: 'var(--cream)' }}>
          <div className="max-w-3xl mx-auto px-5">
            <motion.div className="text-center mb-12" {...fadeUp}>
              <h2 className="font-display text-3xl desktop:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark)' }}>
                Your account is yours alone — forever
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: 'var(--text-mid)' }}>
                Most apps store your password on their servers — which can be hacked, leaked, or sold. BRIX works differently: your identity lives only on your own device as a private key. There is no password on our servers for anyone to steal.
              </p>
            </motion.div>

            <motion.div {...stagger} className="grid desktop:grid-cols-3 gap-6 mb-12">
              <motion.div {...staggerChild} className="text-center p-6 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: 'var(--blue-pale)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--blue-deep)' }}>
                  <KeyRound className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold mb-1.5" style={{ color: 'var(--text-dark)' }}>No password to forget</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-mid)' }}>Your wallet handles authentication. No emails, no resets, no breaches.</p>
              </motion.div>
              <motion.div {...staggerChild} className="text-center p-6 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: 'var(--blue-pale)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--blue-deep)' }}>
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold mb-1.5" style={{ color: 'var(--text-dark)' }}>Your data is never sold</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-mid)' }}>Scores are public, but your identity stays private unless you choose otherwise.</p>
              </motion.div>
              <motion.div {...staggerChild} className="text-center p-6 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow" style={{ borderColor: 'var(--blue-pale)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--blue-deep)' }}>
                  <MonitorSmartphone className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold mb-1.5" style={{ color: 'var(--text-dark)' }}>Works on phone or computer</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-mid)' }}>Connect from any device. Your wallet travels with you.</p>
              </motion.div>
            </motion.div>

            <motion.div className="flex flex-col items-center gap-3" {...fadeUp}>
              <button
                onClick={() => navigate('/faq')}
                className="flex items-center gap-1.5 text-sm font-medium mb-1 transition-colors"
                style={{ color: 'var(--green-fresh)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--green-mid)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--green-fresh)')}
              >
                Why do we use this instead of a password?
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {!isMobile ? (
                <Button
                  onClick={handleMobileLoginClick}
                  size="lg"
                  className="bg-green-fresh hover:bg-green-mid text-white h-auto py-3.5 px-8 text-base font-medium gap-2 w-full max-w-sm"
                >
                  <Smartphone className="w-4 h-4" />
                  Connect with my phone
                </Button>
              ) : (
                <Button
                  onClick={handleLoginClick}
                  size="lg"
                  className="bg-green-fresh hover:bg-green-mid text-white h-auto py-3.5 px-8 text-base font-medium gap-2 w-full max-w-sm"
                >
                  Connect with mobile browser
                </Button>
              )}
              {!isMobile && (
                <Button
                  onClick={handleLoginClick}
                  variant="outline"
                  size="lg"
                  className="h-auto py-3.5 px-8 text-base font-medium gap-2 w-full max-w-sm"
                >
                  Connect with desktop wallet
                </Button>
              )}
              <p className="text-sm text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Don't have one yet? We recommend the{' '}
                <button
                  onClick={() => navigate('/faq#mycelia')}
                  className="font-semibold underline underline-offset-2 transition-colors"
                  style={{ color: 'var(--text-mid)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--green-fresh)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-mid)')}
                >Mycelia app</button>
                {' '}— it's made to work together with BRIX and handles all the complexity for you.{' '}
                <a
                  href="#"
                  className="underline underline-offset-2 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--green-fresh)' }}
                >
                  Install here
                </a>
              </p>
            </motion.div>
          </div>
        </section>

        {/* ═══ Section 6: Footer ═════════════════════════════════ */}
        <footer className="py-5" style={{ backgroundColor: 'var(--blue-deep)' }}>
          <div className="max-w-5xl mx-auto px-5 grid grid-cols-3 items-center">
            <span className="font-display font-bold text-white tracking-wide text-sm">BRIX</span>
            <nav className="flex items-center justify-center gap-6 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white/80 transition-colors">About</button>
              <button onClick={() => navigate('/faq')} className="hover:text-white/80 transition-colors">FAQ</button>
              <button onClick={() => navigate('/contact')} className="hover:text-white/80 transition-colors">Contact</button>
            </nav>
            <nav className="flex items-center justify-end gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Privacy</a>
              <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Terms</a>
            </nav>
          </div>
        </footer>
      </div>

      {/* ═══ Auth Dialog ═════════════════════════════════════════ */}
      <Dialog
        open={authDialogOpen && isAuthActive}
        onOpenChange={(open) => {
          if (!open) handleResetLogin();
        }}
      >
        <DialogContent className={isQRScanning ? 'max-w-2xl' : 'max-w-md'}>
          {renderAuthState()}
        </DialogContent>
      </Dialog>
    </>
  );
}
