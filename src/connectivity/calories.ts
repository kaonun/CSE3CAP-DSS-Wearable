/**
 * There is no standard BLE GATT characteristic for calorie burn — unlike
 * heart rate and cadence, it is never a raw sensor reading here. This is a
 * rough estimate derived from heart rate and elapsed time, assuming a
 * generic adult resting rate. The UI must always label it as an estimate.
 */
const ASSUMED_RESTING_BPM = 70;
const BASE_KCAL_PER_MINUTE = 4;
const KCAL_PER_MINUTE_PER_BPM_ABOVE_RESTING = 0.08;

/** Estimated kcal burned over one minute at a given average heart rate. */
export function estimateCaloriesPerMinute(averageHeartRate: number): number {
  const above = Math.max(0, averageHeartRate - ASSUMED_RESTING_BPM);
  return BASE_KCAL_PER_MINUTE + above * KCAL_PER_MINUTE_PER_BPM_ABOVE_RESTING;
}
