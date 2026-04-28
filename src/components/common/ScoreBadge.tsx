import { rankColorFromNormalized, toDisplayScore } from '../../lib/getBrixColor';

interface ScoreBadgeProps {
  normalizedScore: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'px-2.5 py-1 text-sm',
  md: 'px-3 py-1 text-base',
  lg: 'px-4 py-2 text-2xl',
};

export function ScoreBadge({ normalizedScore, size = 'md', className = '' }: ScoreBadgeProps) {
  const { bgClass } = rankColorFromNormalized(normalizedScore);
  return (
    <span className={`${bgClass} text-white font-display font-bold rounded-xl shadow-sm ${sizeClasses[size]} ${className}`}>
      {toDisplayScore(normalizedScore)}
    </span>
  );
}
