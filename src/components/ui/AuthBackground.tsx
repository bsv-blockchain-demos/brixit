import React from 'react';

/** Stylized leaf — tip points up by default. Clean teardrop shape with no protrusions. */
const Leaf = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 155" fill="none" className={className}>
    {/* Main blade — clean teardrop */}
    <path
      d="M50,10 C70,10 86,32 86,65 C86,98 70,122 50,132 C30,122 14,98 14,65 C14,32 30,10 50,10 Z"
      fill="currentColor"
    />
    {/* Centre vein */}
    <line x1="50" y1="14" x2="50" y2="128" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />
    {/* Side veins */}
    <path d="M50,40 C60,46 66,58 67,72" stroke="white" strokeWidth="1" strokeOpacity="0.18" fill="none" />
    <path d="M50,62 C58,68 62,80 60,94" stroke="white" strokeWidth="1" strokeOpacity="0.18" fill="none" />
    <path d="M50,40 C40,46 34,58 33,72" stroke="white" strokeWidth="1" strokeOpacity="0.18" fill="none" />
    <path d="M50,62 C42,68 38,80 40,94" stroke="white" strokeWidth="1" strokeOpacity="0.18" fill="none" />
    {/* Stem */}
    <path d="M50,132 L50,152" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

/** Wider rounder leaf for variety. */
const LeafRound = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 130 140" fill="none" className={className}>
    {/* Main blade */}
    <path
      d="M65,10 C92,10 116,32 118,62 C120,92 104,116 65,122 C26,116 10,92 12,62 C14,32 38,10 65,10 Z"
      fill="currentColor"
    />
    {/* Monstera-style splits */}
    <path d="M24,68 C18,54 28,40 38,47 C48,54 44,74 24,68 Z" fill="white" fillOpacity="0.35" />
    <path d="M106,68 C112,54 102,40 92,47 C82,54 86,74 106,68 Z" fill="white" fillOpacity="0.35" />
    {/* Centre vein */}
    <line x1="65" y1="14" x2="65" y2="118" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />
    {/* Side veins */}
    <path d="M65,40 C78,46 86,58 86,74" stroke="white" strokeWidth="1" strokeOpacity="0.18" fill="none" />
    <path d="M65,40 C52,46 44,58 44,74" stroke="white" strokeWidth="1" strokeOpacity="0.18" fill="none" />
    {/* Stem */}
    <path d="M65,122 L65,136" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-green-50 to-gray-100 overflow-hidden">

      {/* ── Decorative leaves ─────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>

        {/* Bottom-left cluster */}
        <LeafRound className="absolute -bottom-6 -left-10 w-52 text-green-500 opacity-20 rotate-[-18deg]" />
        <Leaf      className="absolute -bottom-2  left-20  w-36 text-green-600 opacity-15 rotate-[12deg]" />
        <Leaf      className="absolute bottom-20  -left-6  w-28 text-green-400 opacity-20 rotate-[-35deg]" />

        {/* Top-right cluster */}
        <LeafRound className="absolute -top-6 -right-10 w-52 text-green-500 opacity-20 rotate-[162deg]" />
        <Leaf      className="absolute -top-2  right-20  w-36 text-green-600 opacity-15 rotate-[195deg]" />
        <Leaf      className="absolute top-20  -right-6  w-28 text-green-400 opacity-20 rotate-[145deg]" />

        {/* Subtle accent — top-left (stem off-screen toward corner) */}
        <Leaf className="absolute -top-4 -left-4 w-24 text-green-400 opacity-10 rotate-[135deg]" />
        <Leaf className="absolute -top-2 left-4 w-16 text-green-500 opacity-10 rotate-[115deg]" />

        {/* Subtle accent — bottom-right (stem off-screen toward corner) */}
        <Leaf className="absolute -bottom-4 -right-4 w-24 text-green-400 opacity-10 rotate-[-45deg]" />
        <Leaf className="absolute -bottom-2 right-4 w-16 text-green-500 opacity-10 rotate-[-65deg]" />
      </div>

      {/* ── Page content ──────────────────────────────────── */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        {children}
      </div>

    </div>
  );
}
