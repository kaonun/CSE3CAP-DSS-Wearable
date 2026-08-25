import { BUCKET_MS } from './constants';
import type { Summary } from './summaries';

export type RangeKey = 'today' | 'week' | 'month';

export const RANGE_MS: Record<RangeKey, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Width of one chart column per range. Stored data is per-minute, which is far
 * more points than a phone-width chart can show, so points are regrouped to
 * roughly 50-100 columns per range.
 */
export const GROUP_MS: Record<RangeKey, number> = {
  today: 15 * 60 * 1000,
  week: 2 * 60 * 60 * 1000,
  month: 12 * 60 * 60 * 1000,
};

export type Stats = {
  /** Sample-weighted mean, so long buckets count for more than short ones. */
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  /**
   * Resting proxy: the 5th percentile of per-minute minima. A true resting
   * rate needs sleep/activity context the app does not collect, so this
   * reports the low end of observed readings instead of implying more.
   */
  resting: number | null;
  /** Minutes that produced at least one reading. */
  activeMinutes: number;
  samples: number;
};

export type ChartPoint = {
  start: number;
  min: number;
  max: number;
  avg: number;
  count: number;
};

export function filterByRange(summaries: Summary[], range: RangeKey, now = Date.now()): Summary[] {
  const cutoff = now - RANGE_MS[range];
  return summaries.filter(summary => summary.bucketStart >= cutoff);
}

function percentile(sorted: number[], fraction: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)));
  return sorted[index];
}

export function computeStats(summaries: Summary[]): Stats {
  if (summaries.length === 0) {
    return { average: null, minimum: null, maximum: null, resting: null, activeMinutes: 0, samples: 0 };
  }

  let weighted = 0;
  let samples = 0;
  let minimum = Infinity;
  let maximum = -Infinity;

  for (const summary of summaries) {
    weighted += summary.avg * summary.count;
    samples += summary.count;
    minimum = Math.min(minimum, summary.min);
    maximum = Math.max(maximum, summary.max);
  }

  const minima = summaries.map(summary => summary.min).sort((a, b) => a - b);

  return {
    average: samples > 0 ? Math.round(weighted / samples) : null,
    minimum: Number.isFinite(minimum) ? minimum : null,
    maximum: Number.isFinite(maximum) ? maximum : null,
    resting: percentile(minima, 0.05),
    // Each stored summary covers one minute that had readings.
    activeMinutes: new Set(summaries.map(summary => summary.bucketStart)).size,
    samples,
  };
}

/** Regroups per-minute summaries into wider columns for charting. */
export function toChartPoints(summaries: Summary[], range: RangeKey): ChartPoint[] {
  const width = GROUP_MS[range];
  const groups = new Map<number, ChartPoint>();

  for (const summary of summaries) {
    const start = Math.floor(summary.bucketStart / width) * width;
    const existing = groups.get(start);
    if (existing) {
      existing.min = Math.min(existing.min, summary.min);
      existing.max = Math.max(existing.max, summary.max);
      // Track the weighted sum in `avg` while grouping, then divide below.
      existing.avg += summary.avg * summary.count;
      existing.count += summary.count;
    } else {
      groups.set(start, {
        start,
        min: summary.min,
        max: summary.max,
        avg: summary.avg * summary.count,
        count: summary.count,
      });
    }
  }

  return Array.from(groups.values())
    .map(point => ({ ...point, avg: Math.round(point.avg / point.count) }))
    .sort((first, second) => first.start - second.start);
}

/**
 * Integrates a rate-based metric (currently only calories, in kcal/min) over
 * the time it was actually recorded, to get a true total rather than a
 * meaningless sum of averages. Each bucket contributes avg × its own
 * duration — exactly what durationSeconds was tracked for.
 */
export function totalOverDuration(summaries: Summary[]): number {
  const kcalMinutes = summaries.reduce((total, summary) => total + (summary.avg * summary.durationSeconds) / 60, 0);
  return Math.round(kcalMinutes);
}

/** Distinct devices that contributed to a set of summaries. */
export function devicesIn(summaries: Summary[]): { id: string; name: string | null; samples: number }[] {
  const devices = new Map<string, { id: string; name: string | null; samples: number }>();
  for (const summary of summaries) {
    const existing = devices.get(summary.deviceId);
    if (existing) {
      existing.samples += summary.count;
      // Prefer a real name if any summary carried one.
      if (!existing.name && summary.deviceName) existing.name = summary.deviceName;
    } else {
      devices.set(summary.deviceId, {
        id: summary.deviceId,
        name: summary.deviceName,
        samples: summary.count,
      });
    }
  }
  return Array.from(devices.values()).sort((first, second) => second.samples - first.samples);
}

export { BUCKET_MS };
