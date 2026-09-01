import React from 'react';
import { ExternalLink } from 'lucide-react';
import Header from '../Layout/Header';

/**
 * A third-party page framed below the top nav.
 *
 * Shared by /about and /buy so both behave identically. Neither origin sends
 * X-Frame-Options or frame-ancestors today, but that is their call to change,
 * so every instance carries a link out in case the frame comes back blank.
 */
export function WebviewPage({
  url,
  title,
  linkLabel,
}: {
  url: string;
  title: string;
  linkLabel: string;
}) {
  return (
    // Fills the viewport minus the nav row, so the frame scrolls internally
    // rather than the page scrolling around it.
    <div className="flex flex-col min-h-screen bg-surface-canvas">
      <Header />
      <div className="flex items-center justify-end gap-3 px-4 sm:px-6 lg:px-8 py-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-on-bg-body hover:text-on-bg-text"
        >
          {linkLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
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
