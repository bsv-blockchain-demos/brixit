import { useBrixGuide } from './useBrixGuide';

/**
 * Secondary, inline entry point shown beside the BRIX reading field. Steel
 * underlined link (structure/help, never orange) that opens the shared guide.
 */
export function BrixGuideInlineTrigger({ className = '' }: { className?: string }) {
  const { open } = useBrixGuide();
  return (
    <button
      type="button"
      onClick={open}
      className={`text-xs font-medium text-blue-mid underline underline-offset-2 hover:text-blue-deep ${className}`}
    >
      How do I get this?
    </button>
  );
}
