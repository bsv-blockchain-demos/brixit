import React from 'react';

export function AuthBackground({ children }: { children: React.ReactNode }) {
  // Same `--background` (blue-mid) as the rest of the platform so the auth
  // screens share one blue with the app shell and landing page.
  return (
    <div className="relative isolate min-h-screen bg-background overflow-hidden">
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center pointer-events-none select-none opacity-[0.35]"
        style={{ backgroundImage: "url('/backdrop/backdropwallpaper.svg')" }}
      />
      {/* Flat scrim so the on-bg-* text tiers clear WCAG AA. See index.css. */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 pointer-events-none" style={{ background: 'var(--on-bg-scrim)' }} />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 pb-[var(--bottom-inset)]">
        {children}
      </div>
    </div>
  );
}
