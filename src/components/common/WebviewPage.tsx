import React from 'react';
import Header from '../Layout/Header';

/**
 * A third-party page framed below the top nav.
 *
 * Shared by /about and /buy so both behave identically. The frame butts
 * straight up against the nav: a strip above it just to hold an "open in a new
 * tab" link cost a band of chrome on every view to serve the rare case.
 *
 * Neither origin sends X-Frame-Options or frame-ancestors today. If either
 * starts to, this renders an empty frame with no way out, and the link needs
 * to come back somewhere less intrusive.
 */
export function WebviewPage({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  return (
    // Fills the viewport minus the nav row, so the frame scrolls internally
    // rather than the page scrolling around it.
    <div className="flex flex-col min-h-screen bg-surface-canvas">
      <Header />
      <iframe
        src={url}
        title={title}
        className="flex-1 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
