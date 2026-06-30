import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { WalletClient } from '@bsv/sdk';
import { createAuthProof } from '@/lib/authProof';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowRight, ShieldCheck, MonitorSmartphone, Lock, QrCode, ArrowDown, Wallet } from 'lucide-react';
import { getDataFromWallet } from '@/utils/getDataFromWallet';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, useReducedMotion } from 'framer-motion';
import { getMapboxToken } from '@/lib/getMapboxToken';
import { apiGet } from '@/lib/api';
import { findLoginCertificate } from '@/lib/certConfig';
import { MapPreviewPanel, type MapPreview, type MapCluster } from '@/components/landing/MapPreviewPanel';
import { FeedCard } from '@/components/landing/FeedCard';
import { ScoreThresholdBar } from '@/components/common/ScoreThresholdBar';
import { AuthDialogContent } from '@/components/auth/AuthDialogContent';

const BACKEND_PUBLIC_KEY = import.meta.env.VITE_SERVER_PUBLIC_KEY;

// ── Stat column (hero strip) ─────────────────────────────────────
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center border-l border-white/10 first:border-l-0 px-4">
      <p className="font-display text-2xl desktop:text-3xl font-bold text-white">{value}</p>
      <p className="text-xs mt-1 text-on-bg-muted">{label}</p>
    </div>
  );
}


export default function WalletLogin() {
  const [searchParams] = useSearchParams();
  const { userWallet, userPubKey, isConnecting, maxRetriesExceeded, retryCount, initializeWallet, resetWalletState } = useWallet();
  const { walletLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // The landing page is designed light-only. Force light while it is mounted by
  // removing the `.dark` class from <html>, restoring it on unmount. This is purely
  // visual and does NOT change the user's saved theme preference.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) root.classList.remove('dark');
    return () => {
      if (wasDark) root.classList.add('dark');
    };
  }, []);

  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [isCheckingCertificates, setIsCheckingCertificates] = useState(false);
  const [hasStartedLogin, setHasStartedLogin] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [mapPreview, setMapPreview] = useState<MapPreview | null>(null);
  const [hasLocalWallet, setHasLocalWallet] = useState(
    typeof window !== 'undefined' && typeof (window as any).CWI === 'object'
  );

  useEffect(() => {
    if (hasLocalWallet) return;
    let cancelled = false;
    (async () => {
      try {
        const probe = new WalletClient('auto');
        await probe.isAuthenticated();
        if (!cancelled) setHasLocalWallet(true);
      } catch { /* no wallet substrate */ }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const FALLBACK: Omit<MapPreview, 'url'> = {
      center: { lat: 47.5, lng: 8.0 },
      zoom: 2.5,
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
          const live = { ...data, zoom: 2.5 };
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

  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();

  // ── Auth handlers ──────────────────────────────────

  const handleLoginClick = useCallback(() => {
    setHasStartedLogin(true);
    setAuthDialogOpen(true);
    initializeWallet();
  }, [initializeWallet]);

  const handleCTA = useCallback(() => {
    if (hasLocalWallet) {
      handleLoginClick();
    } else {
      navigate('/mobile-login');
    }
  }, [hasLocalWallet, handleLoginClick, navigate]);

  const handleResetLogin = useCallback(() => {
    setHasStartedLogin(false);
    setCertificateError(null);
    setIsCheckingCertificates(false);
    isFetchingRef.current = false;
    hasAttemptedRef.current = false;
    setAuthDialogOpen(false);
    resetWalletState();
  }, [resetWalletState]);

  const checkUserCertificates = useCallback(async () => {
    if (!userWallet || !userPubKey) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsCheckingCertificates(true);
    setCertificateError(null);

    try {
      const certificate = await findLoginCertificate(userWallet);
      if (!certificate) {
        navigate('/create-account');
        return;
      }
      const userData = await getDataFromWallet(userWallet, certificate);

      if (!userData) {
        setCertificateError('Unable to retrieve wallet profile data. Please try again.');
        return;
      }

      const proof = await createAuthProof(userWallet, BACKEND_PUBLIC_KEY, 'login');
      const result = await walletLogin(userPubKey, certificate, userData, proof);

      if (result.success) {
        navigate('/map');
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

  // ── Effects ────────────────────────────────────────

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/map');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (shouldStartMobileQR) navigate('/mobile-login', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Header */}
      <div className="relative overflow-hidden" style={{ backgroundColor: 'hsl(var(--background))' }}>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center pointer-events-none select-none opacity-[0.55]"
          style={{ backgroundImage: "url('/backdrop/backdropwallpaper.svg')" }}
        />

        <header className="relative">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center justify-between py-2">
              <div
                aria-label="BRIXit"
                style={{
                  height: '5rem',
                  aspectRatio: '519.7 / 232.2',
                  backgroundColor: 'white',
                  WebkitMaskImage: 'url(/logos/BRIXit-landing.svg)',
                  maskImage: 'url(/logos/BRIXit-landing.svg)',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'left center',
                  maskPosition: 'left center',
                }}
              />
              <nav className="hidden sm:flex items-center gap-6 text-sm text-on-bg-muted">
                <a href="https://www.bionutrient.org/brix" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors">What is Brix?</a>
                <button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white/80 transition-colors">About</button>
                <button onClick={() => navigate('/faq')} className="hover:text-white/80 transition-colors">FAQ</button>
                <button onClick={() => navigate('/contact')} className="hover:text-white/80 transition-colors">Contact</button>
              </nav>
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleCTA}
                  size="sm"
                  className="bg-action-primary hover:bg-action-primary-hover text-white font-medium rounded-lg px-4"
                >
                  Join BRIXit
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* ═══ Section 1: Hero ═══════════════════════════════════ */}
        <section className="relative flex items-center overflow-hidden">
          <div className="w-full max-w-6xl mx-auto px-5 py-20 desktop:py-28">
            {/* Content row */}
            <div className="grid desktop:grid-cols-2 gap-6 desktop:gap-16 items-center mb-8">

              {/* Left: copy + CTAs */}
              <motion.div {...fadeUp}>
                <p className="uppercase tracking-[0.2em] text-sm font-medium mb-4 text-on-bg-subtle">
                  Real food. Real nutrition.
                </p>
                <h1
                  className="font-landing font-medium text-white leading-[1.12] mb-6"
                  style={{ fontSize: 'clamp(2.125rem, 9vw, 3.25rem)' }}
                >
                  Know how{' '}
                  <em className="italic" style={{ color: 'white' }}>nutritious</em>{' '}
                  your food is.
                </h1>
                <p className="text-base desktop:text-lg leading-relaxed text-on-bg-body mb-8">
                  BRIXit measures the refraction of fresh produce - you can use a refractometer to shop smarter, feed your family better, and share what you discover.
                </p>
                <div className="flex flex-col gap-3 max-w-md">
                  <Button
                    onClick={handleCTA}
                    size="lg"
                    className="bg-action-primary hover:bg-action-primary-hover text-white h-auto py-4 px-7 text-base font-medium gap-2 rounded-xl w-full"
                  >
                    Start tracking my food
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full h-auto py-4 px-7 text-base rounded-xl border-white/20 bg-transparent text-on-bg-body hover:text-white hover:bg-white/5"
                    onClick={() => navigate('/map')}
                  >
                    Browse scores near me
                  </Button>
                  <p className="text-sm text-on-bg-muted">
                    Free &middot; No credit card &middot; Your data is yours
                  </p>
                </div>
              </motion.div>

              {/* Right: map preview */}
              <MapPreviewPanel mapPreview={mapPreview} />
            </div>

            {/* Stats strip */}
            <motion.div
              className="mt-16 desktop:mt-20 grid grid-cols-3 max-w-md desktop:max-w-xl mx-auto desktop:mx-0 border-t border-white/10 pt-8"
              {...(prefersReducedMotion ? {} : { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.5, delay: 0.35 } })}
            >
              <Stat value="60+" label="crops you can test" />
              <Stat value="120+" label="brands tracked" />
              <Stat value="100%" label="readings anchored on-chain" />
            </motion.div>
          </div>
        </section>
      </div>

      <div className="overflow-x-hidden">

        {/* ═══ Section 2: What is BRIX? ══════════════════════════ */}
        <section id="about" className="py-20 desktop:py-28" style={{ backgroundColor: 'hsl(var(--card))' }}>
          <div className="max-w-5xl mx-auto px-5">
            <div className="grid desktop:grid-cols-2 gap-12 desktop:gap-16 items-start">
              {/* Left column — text */}
              <div>
                <motion.div className="mb-8" {...fadeUp}>
                  <p className="uppercase tracking-[0.2em] text-sm font-medium mb-3" style={{ color: 'var(--blue-mid)' }}>
                    What is a BRIXit score?
                  </p>
                  <h2 className="font-landing text-3xl desktop:text-4xl font-medium" style={{ color: 'var(--text-dark)' }}>
                    A number that tells you how{' '}
                    <em style={{ color: 'var(--blue-mid)' }}>good</em>{' '}
                    your food really is
                  </h2>
                </motion.div>

                <motion.div className="space-y-5" {...fadeUp}>
                  <p className="text-lg leading-relaxed" style={{ color: 'var(--text-mid)' }}>
                    The BRIXit score measures the dissolved solids in fresh produce: minerals, amino acids, sugars, and other compounds.
                  </p>
                  <p className="text-lg leading-relaxed" style={{ color: 'var(--text-mid)' }}>
                    Higher scores often indicate a plant that was photosynthesising well and functioning efficiently, conditions linked to better flavour and nutrition.
                  </p>
                  <p className="text-lg leading-relaxed" style={{ color: 'var(--text-mid)' }}>
                    One carrot can score 6. Another, grown in living soil, can score 18. Same vegetable. Very different nutrition. Now you can know what you're buying.
                  </p>
                </motion.div>
              </div>

              {/* Right column — merged score guide card (one surface, two regions) */}
              <motion.div
                className="rounded-2xl bg-card border border-hairline shadow-sm overflow-hidden"
                {...fadeUp}
              >
                {/* Region 1 — what each tier means */}
                <div className="px-7 py-6">
                  <p className="uppercase tracking-[0.2em] text-sm font-medium mb-4" style={{ color: 'var(--blue-mid)' }}>
                    Score Guide
                  </p>
                  {[
                    { tier: 'Excellent', bg: 'bg-score-excellent', desc: 'Well above the expected range for this crop.' },
                    { tier: 'Good',      bg: 'bg-score-good',      desc: 'Above the crop average. Better than most commercial produce.' },
                    { tier: 'Average',   bg: 'bg-score-average',   desc: 'Near the crop average. Typical of commercial growing.' },
                    { tier: 'Poor',      bg: 'bg-score-poor',      desc: 'Below the expected range. Low nutrient density for this crop.' },
                  ].map((t, i) => (
                    <div key={t.tier} className={`grid grid-cols-[14px_1fr] gap-3.5 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
                      <span className={`w-3.5 h-3.5 rounded-[5px] mt-[3px] ${t.bg}`} />
                      <div>
                        <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-dark)' }}>{t.tier}</p>
                        <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--text-mid)' }}>{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Region 2 — how each crop is judged */}
                <div className="px-7 py-6 border-t border-hairline">
                  <p className="uppercase tracking-[0.2em] text-sm font-medium mb-3" style={{ color: 'var(--blue-mid)' }}>
                    How each crop is judged
                  </p>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-mid)' }}>
                    Ranges are relative to each crop's expected values. A 14&nbsp;BRIXit apple is only good, but a 14&nbsp;BRIXit banana is excellent.
                  </p>
                  <div className="space-y-5">
                    {[
                      { crop: 'Apple',  poor: 6, average: 10, good: 14, excellent: 18 },
                      { crop: 'Banana', poor: 8, average: 10, good: 12, excellent: 14 },
                    ].map(({ crop, poor, average, good, excellent }) => (
                      <div key={crop}>
                        <p className="font-landing text-xl mb-2" style={{ color: 'var(--text-dark)' }}>{crop}</p>
                        <ScoreThresholdBar fullWidth mode="range" poor={poor} average={average} good={good} excellent={excellent} />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══ Section 3: Community Scores ═══════════════════════ */}
        <section id="community" className="py-20 desktop:py-28" style={{ backgroundColor: 'var(--bone)' }}>
          <div className="max-w-5xl mx-auto px-5">
            <motion.div className="mb-10" {...fadeUp}>
              <p className="uppercase tracking-[0.2em] text-sm font-medium mb-3" style={{ color: 'var(--blue-mid)' }}>
                Community
              </p>
              <h2 className="font-landing text-3xl desktop:text-4xl font-medium" style={{ color: 'var(--text-dark)' }}>
                What people are <em style={{ color: 'var(--blue-mid)' }}>finding</em>
              </h2>
            </motion.div>

            <motion.div {...stagger} className="grid desktop:grid-cols-3 gap-5">
              <motion.div {...staggerChild}>
                <FeedCard product="Biodynamic Tomatoes" location="Hopp Farm · Basel" score={13.0} normalizedScore={1.81} user="Sandra K." />
              </motion.div>
              <motion.div {...staggerChild}>
                <FeedCard product="Organic Apples" location="Migros Oerlikon" score={15.0} normalizedScore={1.56} user="Marie R." />
              </motion.div>
              <motion.div {...staggerChild}>
                <FeedCard product="Baby Leaf Salad" location="Coop Geneva" score={5.5} normalizedScore={1.19} user="Céline L." />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══ Section 4: Our Vision ═════════════════════════════ */}
        <section className="py-14 desktop:py-24" style={{ backgroundColor: 'var(--green-tint)' }}>
          <div className="max-w-[680px] mx-auto px-5 text-center">
            <motion.div {...fadeUp}>
              <p className="uppercase tracking-[0.2em] text-sm font-medium" style={{ color: 'var(--blue-mid)' }}>
                Our Vision
              </p>
              <h2
                className="font-landing text-3xl desktop:text-4xl font-medium mt-4"
                style={{ color: 'var(--text-dark)' }}
              >
                Locally we <em style={{ color: 'var(--blue-mid)' }}>act</em>, globally we <em style={{ color: 'var(--blue-mid)' }}>share</em>.
              </h2>
              <p className="text-lg leading-relaxed mt-6" style={{ color: 'var(--text-mid)' }}>
                People who buy food can test it and share its quality with everyone else. Ten people in a small city can complete a review of local food quality in a month. Locally we act, globally we share.
              </p>
              <p className="text-lg leading-relaxed mt-4" style={{ color: 'var(--text-mid)' }}>
                Sharing, learning, and acting together, we put our power and our money toward the betterment of our families, and grow the world we want to see.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ═══ Section 4b: Mission ═══════════════════════════════ */}
        {/* The one saturated full-bleed block in this run of the page. No CTA of
            its own — the Connect section below is the single conversion. */}
        <section className="relative overflow-hidden py-20 desktop:py-32" style={{ backgroundColor: 'hsl(var(--background))' }}>
          {/* faint depth glow so the flat steel feels alive, not a paint chip */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,0.10), transparent 55%)' }}
          />
          <div className="relative max-w-[820px] mx-auto px-5 text-center">
            <motion.div {...stagger}>
              <motion.p {...staggerChild} className="uppercase tracking-[0.2em] text-sm font-medium mb-5 text-on-bg-subtle">
                Our Mission
              </motion.p>
              <motion.h2
                {...staggerChild}
                className="font-landing text-3xl desktop:text-4xl font-medium text-white leading-tight mb-6"
              >
                Every score you submit helps{' '}
                <em style={{ color: 'white' }}>another family</em>{' '}
                eat better
              </motion.h2>
              <motion.p {...staggerChild} className="text-lg leading-relaxed text-on-bg-body mx-auto" style={{ maxWidth: '540px' }}>
                Good food knowledge shouldn't be locked away. When you share a score, you're not just helping yourself, you're changing what your whole community reaches for.
              </motion.p>

              {/* Social-proof line — replaces the count the old button used to carry. */}
              <motion.div {...staggerChild} className="inline-flex items-center gap-2.5 mt-8 text-xs tracking-wide text-white/80">
                <span className="inline-flex">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="w-4 h-4 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid var(--blue-mid)', marginLeft: i === 0 ? 0 : '-5px' }}
                    />
                  ))}
                </span>
                Thousands of shoppers sharing what they find
              </motion.div>

              {/* Quiet scroll cue (NOT a primary CTA) — smooth-scrolls to Connect. */}
              <motion.div {...staggerChild} className="mt-12">
                <button
                  type="button"
                  onClick={() => document.getElementById('connect')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-white text-sm font-medium border transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.34)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.34)'; }}
                >
                  Get started in a tap
                  <motion.span
                    className="inline-flex"
                    animate={prefersReducedMotion ? undefined : { y: [0, 3, 0] }}
                    transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </motion.span>
                </button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══ Section 5: Privacy / Connect ══════════════════════ */}
        {/* The page's single real conversion. The five interactive elements
            (why-link, QR button, desktop-wallet button, Mycelia link, Install
            link) keep their production labels, URLs, and handlers unchanged —
            only the layout/styling around them was refreshed. */}
        <section id="connect" className="py-20 desktop:py-28" style={{ backgroundColor: 'var(--paper)' }}>
          <div className="max-w-[760px] mx-auto px-5 text-center">

            <motion.p {...fadeUp} className="uppercase tracking-[0.2em] text-sm font-medium mb-6" style={{ color: 'var(--blue-mid)' }}>
              Private by design
            </motion.p>

            <motion.h2
              {...fadeUp}
              className="font-landing text-3xl desktop:text-4xl font-medium mb-5"
              style={{ color: 'var(--text-dark)' }}
            >
              Your account is yours alone, <em style={{ fontStyle: 'italic', color: 'var(--blue-mid)' }}>forever</em>
            </motion.h2>

            <motion.p {...fadeUp} className="text-lg leading-relaxed mx-auto mb-12" style={{ color: 'var(--text-mid)', maxWidth: '500px' }}>
              Your identity lives on your device as a private key, never on our servers. Nothing to leak, nothing to steal.
            </motion.p>

            {/* Feature trio — no boxes, hairline-divided, airy. */}
            <motion.div {...stagger} className="grid desktop:grid-cols-3 max-w-[720px] mx-auto mb-12">
              <motion.div {...staggerChild} className="px-6 py-5 desktop:py-1 text-center">
                <Lock className="w-[22px] h-[22px] mx-auto mb-3" style={{ color: 'var(--blue-mid)' }} />
                <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--text-dark)' }}>No password to forget</h3>
                <p className="text-xs leading-normal" style={{ color: 'var(--text-mid)' }}>Your wallet signs you in. No emails, resets, or breaches.</p>
              </motion.div>
              <motion.div {...staggerChild} className="px-6 py-5 desktop:py-1 text-center border-t desktop:border-t-0 desktop:border-l" style={{ borderColor: 'var(--hairline)' }}>
                <ShieldCheck className="w-[22px] h-[22px] mx-auto mb-3" style={{ color: 'var(--blue-mid)' }} />
                <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--text-dark)' }}>Your data is never sold</h3>
                <p className="text-xs leading-normal" style={{ color: 'var(--text-mid)' }}>Scores are public. Your identity stays yours.</p>
              </motion.div>
              <motion.div {...staggerChild} className="px-6 py-5 desktop:py-1 text-center border-t desktop:border-t-0 desktop:border-l" style={{ borderColor: 'var(--hairline)' }}>
                <MonitorSmartphone className="w-[22px] h-[22px] mx-auto mb-3" style={{ color: 'var(--blue-mid)' }} />
                <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--text-dark)' }}>Phone or computer</h3>
                <p className="text-xs leading-normal" style={{ color: 'var(--text-mid)' }}>Connect from any device. Your wallet comes with you.</p>
              </motion.div>
            </motion.div>

            {/* Connect buttons — stacked, equal-width column. UNCHANGED handlers/labels. */}
            <motion.div {...fadeUp} className="flex flex-col items-center gap-2.5 w-full max-w-[360px] mx-auto mb-5">
              {!isMobile ? (
                <Button
                  onClick={() => navigate('/mobile-login')}
                  size="lg"
                  className="bg-action-primary hover:bg-action-primary-hover text-white h-auto py-3.5 px-5 text-sm font-medium gap-2 w-full"
                >
                  <QrCode className="w-4 h-4" />
                  Connect with my phone via QR code
                </Button>
              ) : (
                <Button
                  onClick={handleLoginClick}
                  size="lg"
                  className="bg-action-primary hover:bg-action-primary-hover text-white h-auto py-3.5 px-5 text-sm font-medium gap-2 w-full"
                >
                  Connect with mobile browser
                </Button>
              )}
              {!isMobile && (
                <Button
                  onClick={handleLoginClick}
                  variant="outline"
                  size="lg"
                  className="h-auto py-3.5 px-5 text-sm font-medium gap-2 w-full"
                >
                  Connect with desktop wallet
                </Button>
              )}
            </motion.div>

            {/* Quiet "why" text link — UNCHANGED handler/label. */}
            <motion.div {...fadeUp} className="mb-11">
              <button
                onClick={() => navigate('/faq')}
                className="text-sm transition-colors underline decoration-1 underline-offset-4 hover:opacity-80"
                style={{ color: 'var(--blue-deep)', textDecorationColor: 'var(--blue-light)' }}
              >
                Why do we use this instead of a password?
              </button>
            </motion.div>

            {/* Mycelia recommendation lockup — BOTH links (Mycelia app, Install here) UNCHANGED. */}
            <motion.div {...fadeUp} className="flex items-center gap-3 max-w-[520px] mx-auto text-left rounded-xl bg-card" style={{ border: '1px solid var(--hairline)', padding: '13px 18px' }}>
              <span className="flex-none w-[34px] h-[34px] rounded-[9px] inline-flex items-center justify-center text-white" style={{ background: 'var(--blue-mid)' }}>
                <Wallet className="w-[18px] h-[18px]" />
              </span>
              <span className="text-xs leading-relaxed" style={{ color: 'var(--text-mid)' }}>
                Don't have one yet? We recommend the{' '}
                <button
                  onClick={() => navigate('/faq#mycelia')}
                  className="font-semibold underline decoration-1 underline-offset-2 hover:opacity-80"
                  style={{ color: 'var(--blue-deep)' }}
                >Mycelia app</button>. It's made to work together with BRIXit and handles all the complexity for you.{' '}
                <a
                  href="https://mycelia.life"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline decoration-1 underline-offset-2 whitespace-nowrap hover:opacity-80"
                  style={{ color: 'var(--blue-deep)' }}
                >
                  Install here
                </a>
              </span>
            </motion.div>

          </div>
        </section>

        {/* ═══ Section 6: Footer ═════════════════════════════════ */}
        <footer className="py-5" style={{ backgroundColor: 'var(--green-fresh)', paddingBottom: 'calc(1.25rem + var(--bottom-inset))' }}>
          <div className="max-w-5xl mx-auto px-5 grid grid-cols-3 items-center">
            <img src="/logos/BRIXit-footer.svg" alt="BRIXit" className="h-6" />
            <nav className="flex items-center justify-center gap-6 text-sm text-on-bg-muted">
              <a href="https://www.bionutrient.org/brix" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors">What is Brix?</a>
              <button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white/80 transition-colors">About</button>
              <button onClick={() => navigate('/faq')} className="hover:text-white/80 transition-colors">FAQ</button>
              <button onClick={() => navigate('/contact')} className="hover:text-white/80 transition-colors">Contact</button>
            </nav>
            <nav className="flex items-center justify-end gap-4 text-xs text-on-bg-faint">
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Privacy</a>
              <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Terms</a>
            </nav>
          </div>
        </footer>
      </div>

      {/* ═══ Auth Dialog ═════════════════════════════════════════ */}
      <Dialog
        open={authDialogOpen && hasStartedLogin}
        onOpenChange={(open) => {
          if (!open) handleResetLogin();
        }}
      >
        <DialogContent className="max-w-md">
          <AuthDialogContent
            hasStartedLogin={hasStartedLogin}
            isConnecting={isConnecting}
            maxRetriesExceeded={maxRetriesExceeded}
            isCheckingCertificates={isCheckingCertificates}
            certificateError={certificateError}
            retryCount={retryCount}
            onCheck={checkUserCertificates}
            onReset={handleResetLogin}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
