import React from 'react';
import { cn } from '@/lib/utils';

interface PageBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageBackground({ children, className, ...props }: PageBackgroundProps) {
  return (
    <div className={cn('relative isolate bg-background', className)} {...props}>
      {/* `fixed` so the wallpaper doesn't rescale on content height changes. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center pointer-events-none select-none opacity-[0.55]"
        style={{ backgroundImage: "url('/backdrop/backdropwallpaper.svg')" }}
      />
      {children}
    </div>
  );
}
