import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import { auth, db } from '@/firebase';

/** Readings are aggregated into buckets of this width before being stored. */
export const BUCKET_MS = 60_000;

export type Summary = {
  deviceId: string;
  deviceName: string | null;
  metric: 'heartRate';
  bucketStart: number;
  min: number;
  max: number;
  avg: number;
  count: number;
};

/** An in-progress bucket. `sum` is kept so the average stays exact. */
export type OpenBucket = {
  deviceId: string;
  deviceName: string | null;
  bucketStart: number;
  min: number;
  max: number;
  sum: number;
  count: number;
};

export function bucketStartFor(timestamp: number): number {
  return Math.floor(timestamp / BUCKET_MS) * BUCKET_MS;
}

export function bucketKey(deviceId: string, bucketStart: number): string {
  return `${deviceId}::${bucketStart}`;
}

/**
 * Firestore document ids may not contain "/", and device ids are MAC-style
 * strings full of colons. The mapping only needs to be stable, since the id is
 * derived from the same inputs every time.
 */
function documentId(deviceId: string, bucketStart: number): string {
  return `${deviceId.replace(/[^A-Za-z0-9._-]/g, '_')}_${bucketStart}`;
}

export function summaryFromBucket(bucket: OpenBucket): Summary {
  return {
    deviceId: bucket.deviceId,
    deviceName: bucket.deviceName,
    metric: 'heartRate',
    bucketStart: bucket.bucketStart,
    min: bucket.min,
    max: bucket.max,
    // The rules require min <= avg <= max, so clamp rather than risk a
    // rounding artefact pushing the average outside the observed range.
    avg: Math.min(Math.max(Math.round(bucket.sum / bucket.count), bucket.min), bucket.max),
    count: bucket.count,
  };
}

function requireContext() {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return null;
  return { database: db, uid };
}

/** Writes one summary. Document ids are deterministic, so retries are safe. */
export async function writeSummary(summary: Summary): Promise<void> {
  const context = requireContext();
  if (!context) throw new Error('Not signed in');

  await setDoc(
    doc(
      context.database,
      'users',
      context.uid,
      'summaries',
      documentId(summary.deviceId, summary.bucketStart),
    ),
    {
      deviceId: summary.deviceId,
      deviceName: summary.deviceName,
      metric: summary.metric,
      bucketStart: Timestamp.fromMillis(summary.bucketStart),
      min: summary.min,
      max: summary.max,
      avg: summary.avg,
      count: summary.count,
      createdAt: serverTimestamp(),
    },
  );
}

/** Fetches stored summaries, newest bucket first. */
export async function fetchSummaries(sinceMs?: number): Promise<Summary[]> {
  const context = requireContext();
  if (!context) return [];

  const summaries = collection(context.database, 'users', context.uid, 'summaries');
  const constraints = sinceMs
    ? [where('bucketStart', '>=', Timestamp.fromMillis(sinceMs)), orderBy('bucketStart', 'desc')]
    : [orderBy('bucketStart', 'desc')];

  const snapshot = await getDocs(query(summaries, ...constraints));
  return snapshot.docs.map(entry => {
    const data = entry.data();
    const bucketStart = data.bucketStart as Timestamp | undefined;
    return {
      deviceId: String(data.deviceId ?? ''),
      deviceName: (data.deviceName as string | null) ?? null,
      metric: 'heartRate' as const,
      bucketStart: bucketStart ? bucketStart.toMillis() : 0,
      min: Number(data.min ?? 0),
      max: Number(data.max ?? 0),
      avg: Number(data.avg ?? 0),
      count: Number(data.count ?? 0),
    };
  });
}

/** Permanently removes every stored summary for the signed-in user. */
export async function deleteAllSummaries(): Promise<number> {
  const context = requireContext();
  if (!context) return 0;

  const summaries = collection(context.database, 'users', context.uid, 'summaries');
  const snapshot = await getDocs(summaries);
  await Promise.all(snapshot.docs.map(entry => deleteDoc(entry.ref)));
  return snapshot.size;
}
