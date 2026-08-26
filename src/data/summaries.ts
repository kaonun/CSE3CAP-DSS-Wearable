import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { auth, db } from "../../services/firebaseConfig";
import { BUCKET_MS } from "./constants";

export { BUCKET_MS };

/**
 * A metric id — one of the three built-in keys, or a `custom:<uuid>` string
 * for a user-defined characteristic. Kept as a plain string (rather than
 * importing MetricKey from @/connectivity) so this Firebase data module
 * never depends on the wider metric type, and so custom ids pass through
 * untyped like everything else here.
 */
export type Summary = {
  deviceId: string;
  deviceName: string | null;
  metric: string;
  bucketStart: number;
  min: number;
  max: number;
  avg: number;
  count: number;
  /** Span between the first and last reading in this bucket, not a count of samples. */
  durationSeconds: number;
};

/** An in-progress bucket. `sum` is kept so the average stays exact. */
export type OpenBucket = {
  deviceId: string;
  deviceName: string | null;
  metric: string;
  bucketStart: number;
  min: number;
  max: number;
  sum: number;
  count: number;
  firstTimestamp: number;
  lastTimestamp: number;
};

export function bucketStartFor(timestamp: number): number {
  return Math.floor(timestamp / BUCKET_MS) * BUCKET_MS;
}

export function bucketKey(
  deviceId: string,
  metric: string,
  bucketStart: number,
): string {
  return `${deviceId}::${metric}::${bucketStart}`;
}

/**
 * Firestore document ids may not contain "/", device ids are MAC-style
 * strings full of colons, and a custom metric's id is itself
 * "custom:<uuid>". The mapping only needs to be stable, since the id is
 * derived from the same inputs every time.
 */
function documentId(
  deviceId: string,
  metric: string,
  bucketStart: number,
): string {
  const safe = (value: string) => value.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${safe(deviceId)}_${safe(metric)}_${bucketStart}`;
}

export function summaryFromBucket(bucket: OpenBucket): Summary {
  return {
    deviceId: bucket.deviceId,
    deviceName: bucket.deviceName,
    metric: bucket.metric,
    bucketStart: bucket.bucketStart,
    min: bucket.min,
    max: bucket.max,
    // The rules require min <= avg <= max, so clamp rather than risk a
    // rounding artefact pushing the average outside the observed range.
    avg: Math.min(
      Math.max(Math.round(bucket.sum / bucket.count), bucket.min),
      bucket.max,
    ),
    count: bucket.count,
    // Falls back to 0 rather than writing NaN/undefined if a bucket somehow
    // predates these fields (e.g. a stale in-memory instance carried across
    // a Fast Refresh reload that changed this shape) — Firestore would
    // reject a non-integer anyway, so this keeps that failure from being
    // silent and permanent for the whole buffered bucket.
    durationSeconds:
      Number.isFinite(bucket.lastTimestamp) &&
      Number.isFinite(bucket.firstTimestamp)
        ? Math.max(
            0,
            Math.round((bucket.lastTimestamp - bucket.firstTimestamp) / 1000),
          )
        : 0,
  };
}

function requireContext() {
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return null;
  return { database: db, uid };
}

/**
 * Writes one summary, merging into any existing document for the same
 * device/metric/minute rather than overwriting it.
 *
 * A minute can legitimately be flushed more than once — e.g. the user opens
 * History or exports data while still connected, forcing the still-forming
 * bucket out early, and then more readings arrive before that same minute
 * ends. Without merging, the later partial write would silently replace the
 * earlier one under the same deterministic document id, undercounting that
 * minute's readings. `avg * count` reconstructs each side's sum well enough
 * for a summary (some rounding drift is acceptable here; this was never
 * exact raw data).
 */
export async function writeSummary(summary: Summary): Promise<void> {
  const context = requireContext();
  if (!context) throw new Error("Not signed in");

  const ref = doc(
    context.database,
    "users",
    context.uid,
    "summaries",
    documentId(summary.deviceId, summary.metric, summary.bucketStart),
  );

  await runTransaction(context.database, async (transaction) => {
    const existing = await transaction.get(ref);
    const data = existing.exists() ? existing.data() : null;

    const existingCount = data ? Number(data.count ?? 0) : 0;
    const mergedCount = existingCount + summary.count;
    const mergedMin = data
      ? Math.min(Number(data.min ?? summary.min), summary.min)
      : summary.min;
    const mergedMax = data
      ? Math.max(Number(data.max ?? summary.max), summary.max)
      : summary.max;
    const mergedSum =
      (data ? Number(data.avg ?? 0) * existingCount : 0) +
      summary.avg * summary.count;
    const mergedAvg = Math.min(
      Math.max(Math.round(mergedSum / mergedCount), mergedMin),
      mergedMax,
    );
    // Sequential partial flushes of the same minute never overlap in time, so
    // their durations add up correctly rather than needing a min/max merge.
    const mergedDuration =
      (data ? Number(data.durationSeconds ?? 0) : 0) + summary.durationSeconds;

    transaction.set(ref, {
      deviceId: summary.deviceId,
      deviceName: summary.deviceName,
      metric: summary.metric,
      bucketStart: Timestamp.fromMillis(summary.bucketStart),
      min: mergedMin,
      max: mergedMax,
      avg: mergedAvg,
      count: mergedCount,
      durationSeconds: mergedDuration,
      createdAt: serverTimestamp(),
    });
  });
}

/** Fetches stored summaries, newest bucket first. */
export async function fetchSummaries(sinceMs?: number): Promise<Summary[]> {
  const context = requireContext();
  if (!context) return [];

  const summaries = collection(
    context.database,
    "users",
    context.uid,
    "summaries",
  );
  const constraints = sinceMs
    ? [
        where("bucketStart", ">=", Timestamp.fromMillis(sinceMs)),
        orderBy("bucketStart", "desc"),
      ]
    : [orderBy("bucketStart", "desc")];

  const snapshot = await getDocs(query(summaries, ...constraints));
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    const bucketStart = data.bucketStart as Timestamp | undefined;
    return {
      deviceId: String(data.deviceId ?? ""),
      deviceName: (data.deviceName as string | null) ?? null,
      // Older documents predate metric-tagging and are heart-rate readings.
      metric:
        typeof data.metric === "string" && data.metric
          ? data.metric
          : "heartRate",
      bucketStart: bucketStart ? bucketStart.toMillis() : 0,
      min: Number(data.min ?? 0),
      max: Number(data.max ?? 0),
      avg: Number(data.avg ?? 0),
      count: Number(data.count ?? 0),
      // Older documents predate duration tracking.
      durationSeconds: Number(data.durationSeconds ?? 0),
    };
  });
}

/** Permanently removes every stored summary for the signed-in user. */
export async function deleteAllSummaries(): Promise<number> {
  const context = requireContext();
  if (!context) return 0;

  const summaries = collection(
    context.database,
    "users",
    context.uid,
    "summaries",
  );
  const snapshot = await getDocs(summaries);
  await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)));
  return snapshot.size;
}
