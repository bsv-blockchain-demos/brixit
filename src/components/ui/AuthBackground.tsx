import React from 'react';

export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-screen bg-background overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-cover bg-center pointer-events-none select-none opacity-[0.55]"
        style={{ backgroundImage: "url('/backdrop/backdropwallpaper.svg')" }}
      />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
