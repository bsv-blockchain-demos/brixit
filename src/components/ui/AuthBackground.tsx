import React from 'react';

export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-cream overflow-hidden">
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
