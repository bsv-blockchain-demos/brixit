import React from 'react';

export function AuthBackground({ children }: { children: React.ReactNode }) {
  // Deliberately `--blue-deep`, not the theme `--background`: the on-bg-*
  // text hierarchy (see index.css) is calibrated for WCAG AA against this
  // dark surface. `--background` (blue-mid) is too light to ever clear
  // 4.5:1 with white text, in either theme, at any opacity. `--blue-deep`
  // also has its own `.dark` value, so this still shifts appropriately
  // when the app theme is dark — just never gets light enough to hurt
  // contrast.
  return (
    <div className="relative isolate min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--blue-deep)' }}>
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center pointer-events-none select-none opacity-30"
        style={{ backgroundImage: "url('/backdrop/backdropwallpaper.svg')" }}
      />
      {/* Scrim: guarantees a dark floor under the texture above so text
          contrast holds regardless of how light the backdrop art gets in
          places, and adds a bit of vignette depth. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,0.08), transparent 55%), linear-gradient(180deg, rgba(8,16,24,0.25), rgba(8,16,24,0.5))' }}
      />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 pb-[var(--bottom-inset)]">
        {children}
      </div>
    </div>
  );
}
