import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { SensorReading } from '@/connectivity';
import {
  BUCKET_MS,
  bucketKey,
  bucketStartFor,
  summaryFromBucket,
  writeSummary,
  type OpenBucket,
} from './summaries';

/** How often completed buckets are checked for and flushed. */
const FLUSH_INTERVAL_MS = 20_000;

/**
 * Cap on buckets held in memory while offline. At one bucket per minute per
 * device this is many hours of buffering; beyond it the oldest are dropped so
 * a long outage cannot grow without bound.
 */
const MAX_PENDING_BUCKETS = 720;

/**
 * Aggregates live readings into one-minute buckets and writes them to
 * Firestore once each bucket closes.
 *
 * Raw readings arrive roughly once a second. Storing each one would be ~3,600
 * writes per hour per device — enough to exhaust Firestore's free tier in a
 * few hours — and would conflict with the project's data-minimisation
 * requirement not to store raw continuous streams. Summarising first keeps it
 * to ~60 writes per hour per device while preserving min/max/average detail.
 */
export function useReadingSync() {
  const buckets = useRef(new Map<string, OpenBucket>());
  const names = useRef(new Map<string, string | null>());
  const flushing = useRef(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Associates a display name with a device id for future readings. */
  const setDeviceName = useCallback((deviceId: string, name: string | null) => {
    names.current.set(deviceId, name);
  }, []);

  const record = useCallback((reading: SensorReading) => {
    if (reading.metric !== 'heartRate') return;

    const bucketStart = bucketStartFor(reading.timestamp);
    const key = bucketKey(reading.deviceId, bucketStart);
    const existing = buckets.current.get(key);

    if (existing) {
      existing.min = Math.min(existing.min, reading.value);
      existing.max = Math.max(existing.max, reading.value);
      existing.sum += reading.value;
      existing.count += 1;
    } else {
      buckets.current.set(key, {
        deviceId: reading.deviceId,
        deviceName: names.current.get(reading.deviceId) ?? null,
        bucketStart,
        min: reading.value,
        max: reading.value,
        sum: reading.value,
        count: 1,
      });
      setPendingCount(buckets.current.size);
    }
  }, []);

  /**
   * Writes every bucket that has closed. `force` also flushes the in-progress
   * bucket, for shutdown and backgrounding where waiting is not an option.
   */
  const flush = useCallback(async (force = false) => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const cutoff = Date.now() - (force ? 0 : BUCKET_MS);
      const ready = Array.from(buckets.current.entries())
        .filter(([, bucket]) => bucket.bucketStart <= cutoff)
        .sort((first, second) => first[1].bucketStart - second[1].bucketStart);

      let wrote = false;
      for (const [key, bucket] of ready) {
        try {
          await writeSummary(summaryFromBucket(bucket));
          buckets.current.delete(key);
          wrote = true;
        } catch (writeError) {
          // Keep the bucket buffered and retry on the next pass — this is the
          // expected path when offline or briefly signed out.
          setError(writeError instanceof Error ? writeError.message : 'Sync failed');
          break;
        }
      }

      if (wrote) {
        setError(null);
        setLastSyncedAt(Date.now());
      }

      // Drop the oldest buckets if a long outage has backed things up.
      if (buckets.current.size > MAX_PENDING_BUCKETS) {
        const ordered = Array.from(buckets.current.entries()).sort(
          (first, second) => first[1].bucketStart - second[1].bucketStart,
        );
        for (const [key] of ordered.slice(0, buckets.current.size - MAX_PENDING_BUCKETS)) {
          buckets.current.delete(key);
        }
      }

      setPendingCount(buckets.current.size);
    } finally {
      flushing.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', state => {
      // Backgrounding can be followed by termination, so close out what we have.
      if (state !== 'active') void flush(true);
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
      void flush(true);
    };
  }, [flush]);

  return { record, setDeviceName, flush, pendingCount, lastSyncedAt, error };
}
