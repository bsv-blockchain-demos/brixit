import { Droplet, ChevronRight } from 'lucide-react';
import { useBrixGuide } from './useBrixGuide';

/**
 * Primary entry point for the Brix guide. Renders a tappable green banner. Once
 * the user ticks "Don't show this again", it becomes a small steel link that
 * restores and reopens the guide.
 */
export function BrixGuideBanner({ className = '' }: { className?: string }) {
  const { open, bannerHidden, showBanner } = useBrixGuide();

  if (bannerHidden) {
    return (
      <button
        type="button"
        onClick={() => {
          showBanner();
          open();
        }}
        className={`text-sm font-medium text-blue-mid underline underline-offset-2 hover:text-blue-deep ${className}`}
      >
        Show the Brix guide again
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open the 30-second Brix guide"
      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition hover:brightness-[0.98] ${className}`}
      style={{
        background: 'var(--green-pale)',
        borderColor: 'color-mix(in srgb, var(--green-fresh) 40%, transparent)',
      }}
    >
      <span className="shrink-0 w-10 h-10 rounded-xl inline-flex items-center justify-center bg-green-mid text-white">
        <Droplet className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold text-[15px] leading-tight text-green-mid">
          New to Brix? Read the 30-second guide
        </span>
        <span className="block text-[13px] text-text-mid leading-tight mt-0.5">
          How to take a reading and read the chart
        </span>
      </span>
      <ChevronRight className="shrink-0 w-5 h-5 text-green-mid" />
    </button>
  );
}
