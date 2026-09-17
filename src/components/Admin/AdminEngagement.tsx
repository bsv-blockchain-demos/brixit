import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { RefreshCw, TrendingDown, TrendingUp, Users, ClipboardList } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { fetchEngagement, type EngagementWeek, type EngagementRange } from '@/lib/adminApi';
import {
  formatWeekLabel,
  formatFullDate,
  totalFor,
  weekOverWeekChange,
  READINGS_BACKFILL_DATE,
} from '@/lib/engagementFormat';
import { describeApiError } from '@/lib/describeApiError';
import AdminEngagementSummary from './AdminEngagementSummary';

const RANGES = [4, 12, 26, 52, 'all'] as const;

// One chart per measure: a shared y-axis would flatten the smaller series.
const SERIES = [
  {
    key: 'new_users' as const,
    label: 'New users',
    caption: 'Accounts created, by week',
    color: 'var(--blue-mid)',
    icon: Users,
  },
  {
    key: 'new_measurements' as const,
    label: 'New measurements',
    caption: 'Readings submitted, by week',
    color: 'var(--green-mid)',
    icon: ClipboardList,
  },
];

function RangePicker({
  weeks,
  onChange,
}: {
  weeks: EngagementRange;
  onChange: (w: EngagementRange) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="inline-flex rounded-lg border border-hairline overflow-hidden"
    >
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={weeks === r}
          onClick={() => onChange(r)}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            weeks === r
              ? 'bg-select-bg text-select-fg'
              : 'bg-transparent text-text-mid hover:bg-surface-canvas'
          }`}
        >
          {r === 'all' ? 'All' : `${r}w`}
        </button>
      ))}
    </div>
  );
}

function Delta({ change }: { change: number | null }) {
  if (change === null) return null;
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-text-mid">
      <Icon aria-hidden className={`w-3.5 h-3.5 ${up ? 'text-score-excellent' : 'text-score-poor'}`} />
      {up ? '+' : ''}{change}% vs the week before
    </span>
  );
}

function SeriesChart({
  series,
  data,
  isLoading,
}: {
  series: (typeof SERIES)[number];
  data: EngagementWeek[];
  isLoading: boolean;
}) {
  const reduce = useReducedMotion();
  const Icon = series.icon;

  const config = {
    [series.key]: { label: series.label, color: series.color },
  } satisfies ChartConfig;

  const total = totalFor(data, series.key);
  const change = weekOverWeekChange(data, series.key);

  return (
    <section className="bg-card border border-hairline rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon aria-hidden className="w-4 h-4 text-text-muted" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {series.label}
            </h3>
          </div>
          <p className="mt-1 text-3xl font-display font-bold text-blue-deep leading-none tabular-nums">
            {isLoading ? '-' : total.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-text-mid">{series.caption}</p>
        </div>
        <div className="text-right shrink-0">
          <Delta change={change} />
        </div>
      </div>

      {/* Single series — the heading names it, so no legend. */}
      <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis
            dataKey="week_start"
            tickFormatter={(value) => formatWeekLabel(String(value))}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
            stroke="var(--text-muted)"
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={44}
            stroke="var(--text-muted)"
          />
          <ChartTooltip
            cursor={{ fill: 'var(--surface-canvas)' }}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => `Week of ${formatWeekLabel(String(value))}`}
              />
            }
          />
          <Bar
            dataKey={series.key}
            fill={`var(--color-${series.key})`}
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reduce}
          />
        </BarChart>
      </ChartContainer>
    </section>
  );
}

export default function AdminEngagement() {
  const queryClient = useQueryClient();
  const [weeks, setWeeks] = useState<EngagementRange>(12);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin-engagement', 'weekly', weeks],
    queryFn: () => fetchEngagement(weeks),
    staleTime: 5 * 60 * 1000,
  });

  const rows = useMemo(() => data?.weeks ?? [], [data]);

  return (
    <div className="space-y-5">
      {/* Scoped to the title row so the button centres on it, not the block. */}
      <div className="text-center">
        <div className="relative">
          <h2 className="text-xl font-display font-bold text-text-dark">Engagement</h2>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-engagement'] })}
            disabled={isFetching}
            aria-label="Refresh engagement"
            className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-mid hover:text-text-dark hover:bg-surface-canvas disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-text-mid">Signups and readings per week</p>
      </div>

      {error && (
        <div className="rounded-lg border border-hairline bg-score-poor-bg px-4 py-3 text-sm">
          <p className="font-medium text-text-dark">{describeApiError(error).title}</p>
          <p className="mt-0.5 text-text-mid">{describeApiError(error).detail}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <RangePicker weeks={weeks} onChange={setWeeks} />
        <p className="text-xs text-text-muted">
          Applies to the charts, locations and categories below. The current week is
          partial, and dates before {formatFullDate(READINGS_BACKFILL_DATE)} are approximate.
        </p>
      </div>

      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
        {SERIES.map((s) => (
          <SeriesChart key={s.key} series={s} data={rows} isLoading={isLoading} />
        ))}
      </div>

      <AdminEngagementSummary range={weeks} />

      {/* Exact values, and a path that doesn't depend on colour. */}
      <details className="bg-card border border-hairline rounded-2xl shadow-sm">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-text-dark">
          View as table
        </summary>
        <div className="overflow-x-auto border-t border-hairline">
          <table className="w-full text-sm">
            <caption className="sr-only">New users and new measurements per week</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                <th scope="col" className="py-2 px-5 font-semibold">Week of</th>
                <th scope="col" className="py-2 pr-5 font-semibold text-right">New users</th>
                <th scope="col" className="py-2 pr-5 font-semibold text-right">New measurements</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.week_start} className="border-t border-hairline">
                  <th scope="row" className="py-2 px-5 font-normal text-text-mid whitespace-nowrap">
                    {formatWeekLabel(w.week_start)}
                  </th>
                  <td className="py-2 pr-5 text-right tabular-nums text-text-dark">{w.new_users}</td>
                  <td className="py-2 pr-5 text-right tabular-nums text-text-dark">{w.new_measurements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
