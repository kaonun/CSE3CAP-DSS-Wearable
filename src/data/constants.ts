/**
 * Shared data constants.
 *
 * Kept separate from summaries.ts so pure analytics code can import them
 * without pulling in the Firebase SDK, which keeps that logic unit-testable.
 */

/** Readings are aggregated into buckets of this width before being stored. */
export const BUCKET_MS = 60_000;
