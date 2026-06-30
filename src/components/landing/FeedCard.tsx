import { Card, CardContent } from '@/components/ui/card';
import { ScoreGauge } from '@/components/common/ScoreGauge';

export function FeedCard({ product, location, normalizedScore, score, user }: {
  product: string;
  location: string;
  normalizedScore: number;
  score: number;
  user: string;
}) {
  return (
    <Card className="overflow-hidden border" style={{ borderColor: 'var(--hairline)' }}>
      <CardContent className="p-5">
        <ScoreGauge normalizedScore={normalizedScore} />
        <p className="font-semibold mt-4" style={{ color: 'var(--text-dark)' }}>{product}</p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{location} · {user} · {score} BRIX</p>
      </CardContent>
    </Card>
  );
}
