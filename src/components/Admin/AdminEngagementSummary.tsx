import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import {
  fetchEngagementSummary,
  type EngagementGeoRow,
  type EngagementRange,
  type EngagementWindow,
} from '@/lib/adminApi';
import { describeApiError } from '@/lib/describeApiError';
import { formatConversion } from '@/lib/engagementFormat';

const METRICS: Array<{
  key: keyof EngagementWindow;
  label: string;
  render?: (w: EngagementWindow) => string;
}> = [
  { key: 'unique_contributors', label: 'Unique contributors' },
  { key: 'repeat_contributors', label: 'Repeat contributors (2+ days)' },
  { key: 'median_readings_per_contributor', label: 'Readings per contributor (median)' },
  {
    key: 'signup_conversion_pct',
    label: 'Signup → first reading',
    render: (w) => formatConversion(w.signup_conversion_pct, w.converted_users, w.new_users),
  },
];

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-hairline rounded-2xl shadow-sm p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-text-mid">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function WindowTable({ windows, isLoading }: { windows: EngagementWindow[]; isLoading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Engagement metrics over rolling windows</caption>
        <thead>
          <tr className="text-xs uppercase tracking-wider text-text-muted">
            <th scope="col" className="text-left font-semibold pb-2">Metric</th>
            {windows.map((w) => (
              <th
                key={w.days ?? 'all'}
                scope="col"
                className="text-right font-semibold pb-2 pl-4 whitespace-nowrap"
              >
                {w.days === null ? 'All' : `${w.days}d`}
              </th>
            ))}
            {isLoading && windows.length === 0 && <th className="text-right pb-2 pl-4">—</th>}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => (
            <tr key={m.key} className="border-t border-hairline">
              <th scope="row" className="text-left font-normal text-text-mid py-2 pr-3">
                {m.label}
              </th>
              {windows.map((w) => (
                <td key={w.days ?? 'all'} className="py-2 pl-4 text-right tabular-nums text-text-dark">
                  {m.render ? m.render(w) : ((w[m.key] as number | null) ?? 0).toLocaleString()}
                </td>
              ))}
              {isLoading && windows.length === 0 && <td className="py-2 pl-4 text-right text-text-muted">—</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeoTable({
  rows,
  unit,
  unknownLabel,
  caption,
  isLoading,
}: {
  rows: EngagementGeoRow[];
  unit: string;
  /** Shown for rows with no place at all — the two tables mean different things by it. */
  unknownLabel: string;
  caption: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">No location data recorded yet.</p>;
  }
  return (
    <div className="overflow-x-auto max-h-72 overflow-y-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-card">
          <tr className="text-xs uppercase tracking-wider text-text-muted">
            <th scope="col" className="text-left font-semibold pb-2">Place</th>
            <th scope="col" className="text-right font-semibold pb-2">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.country}-${r.state}`} className="border-t border-hairline">
              <th scope="row" className="text-left font-normal text-text-mid py-2 pr-3">
                {[r.state, r.country].filter((part) => part && part !== 'Unknown').join(', ') ||
                  unknownLabel}
              </th>
              <td className="py-2 text-right tabular-nums text-text-dark">{r.count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminEngagementSummary({ range }: { range: EngagementRange }) {
  const reduce = useReducedMotion();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-engagement', 'summary', range],
    queryFn: () => fetchEngagementSummary(range),
    staleTime: 5 * 60 * 1000,
  });

  const windows = data?.windows ?? [];
  const categories = data?.categories ?? [];

  const categoryConfig = {
    readings: { label: 'Readings', color: 'var(--green-mid)' },
  } satisfies ChartConfig;

  if (error) {
    return (
      <div className="rounded-lg border border-hairline bg-score-poor-bg px-4 py-3 text-sm">
        <p className="font-medium text-text-dark">{describeApiError(error).title}</p>
        <p className="mt-0.5 text-text-mid">{describeApiError(error).detail}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Contributor activity"
        subtitle="Fixed periods. The range above doesn't apply here."
      >
        <WindowTable windows={windows} isLoading={isLoading} />
        <p className="mt-3 text-xs text-text-muted">
          Includes unverified and rejected readings, so totals run higher than the
          public leaderboard.
        </p>
      </Panel>

      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
        <Panel
          title="Where readings were taken"
          subtitle="By venue. Readings logged without one aren't shown."
        >
          <GeoTable
            rows={data?.geography.by_reading ?? []}
            unit="Readings"
            unknownLabel="No venue location"
            caption="Readings by the location of the venue they were taken at"
            isLoading={isLoading}
          />
        </Panel>
        <Panel title="Where contributors are" subtitle="From account settings. Always all time.">
          <GeoTable
            rows={data?.geography.by_contributor ?? []}
            unit="Contributors"
            unknownLabel="No location added"
            caption="Contributors by the location set on their account"
            isLoading={isLoading}
          />
        </Panel>
      </div>

      <Panel title="Readings by category">
        {isLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-text-muted">No readings yet.</p>
        ) : (
          <>
          /* Single series, so the panel heading names it and no legend is needed.
             Horizontal bars because category names don't fit under a vertical axis. */
          <ChartContainer
            config={categoryConfig}
            className="aspect-auto w-full"
            style={{ height: `${Math.max(160, categories.length * 32)}px` }}
          >
            <BarChart data={categories} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid horizontal={false} stroke="var(--hairline)" />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} stroke="var(--text-muted)" />
              <YAxis
                type="category"
                dataKey="category"
                width={120}
                tickLine={false}
                axisLine={false}
                stroke="var(--text-muted)"
              />
              <ChartTooltip cursor={{ fill: 'var(--surface-canvas)' }} content={<ChartTooltipContent />} />
              <Bar
                dataKey="readings"
                fill="var(--color-readings)"
                radius={[0, 4, 4, 0]}
                isAnimationActive={!reduce}
              />
            </BarChart>
          </ChartContainer>
          {/* Same figures without the colour channel, matching the weekly charts. */}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-text-dark">
              View as table
            </summary>
            <table className="w-full text-sm mt-2">
              <caption className="sr-only">Readings by crop category</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                  <th scope="col" className="font-semibold pb-2">Category</th>
                  <th scope="col" className="font-semibold pb-2 text-right">Readings</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.category} className="border-t border-hairline">
                    <th scope="row" className="text-left font-normal text-text-mid py-2 pr-3">
                      {c.category}
                    </th>
                    <td className="py-2 text-right tabular-nums text-text-dark">
                      {c.readings.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          </>
        )}
      </Panel>
    </div>
  );
}
