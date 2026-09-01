// src/pages/About.tsx
import React from 'react';
import { ExternalLink } from 'lucide-react';
import Header from '../components/Layout/Header';

const ABOUT_URL = 'https://www.bionutrient.org/brixit';

/**
 * Bionutrient's BRIXit page, embedded below the top nav.
 *
 * The origin sends no X-Frame-Options or frame-ancestors, so it frames
 * cleanly today. That is their call to change, not ours, so there is an
 * escape hatch to open it directly if the frame ever comes back blank.
 */
const About = () => (
  // Fills the viewport minus the 64px nav row, so the frame scrolls internally
  // rather than the page scrolling around it.
  <div className="flex flex-col min-h-screen bg-surface-canvas">
    <Header />
    <div className="flex items-center justify-end gap-3 px-4 sm:px-6 lg:px-8 py-2">
      <a
        href={ABOUT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-on-bg-body hover:text-on-bg-text"
      >
        Open on bionutrient.org
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
    <iframe
      src={ABOUT_URL}
      title="About BRIX, from the Bionutrient Food Association"
      className="flex-1 w-full border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  </div>
);

export default About;
