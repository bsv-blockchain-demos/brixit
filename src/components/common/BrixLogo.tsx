interface BrixLogoProps {
  height?: string;
  color?: string;
  className?: string;
}

export function BrixLogo({ height = '2.5rem', color = 'var(--blue-deep)', className }: BrixLogoProps) {
  return (
    <div
      aria-label="Brixit"
      className={className}
      style={{
        height,
        aspectRatio: '519.7 / 124.7',
        backgroundColor: color,
        WebkitMaskImage: 'url(/logos/BRIXit-platform.svg)',
        maskImage: 'url(/logos/BRIXit-platform.svg)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    />
  );
}
