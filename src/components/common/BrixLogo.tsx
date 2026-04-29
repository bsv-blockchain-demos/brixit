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
        aspectRatio: '680.88 / 389.32',
        backgroundColor: color,
        WebkitMaskImage: 'url(/brixit.svg)',
        maskImage: 'url(/brixit.svg)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      }}
    />
  );
}
