import { Card, CardContent } from '@/components/ui/card';

export function FeedCard({ product, location, pct, score, user, rating }: {
  product: string;
  location: string;
  pct: string;
  score: number;
  user: string;
  rating: 'Excellent' | 'Good' | 'Poor';
}) {
  const color = rating === 'Excellent' ? 'var(--green-mid)' : rating === 'Good' ? 'var(--gold)' : 'var(--score-poor)';
  return (
    <Card className="overflow-hidden border" style={{ borderColor: 'var(--blue-pale)' }}>
      <CardContent className="p-5">
        <p className="font-display font-bold text-4xl leading-none" style={{ color }} aria-label={`Score ${pct}, rated ${rating}`}>{pct}</p>
        <p className="text-xs font-medium mt-1" style={{ color }}>{rating}</p>
        <p className="font-semibold mt-4" style={{ color: 'var(--text-dark)' }}>{product}</p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{location} · {user} · {score} BRIX</p>
      </CardContent>
    </Card>
  );
}
