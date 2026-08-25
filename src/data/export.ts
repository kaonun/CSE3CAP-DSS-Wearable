import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { fetchSummaries, type Summary } from './summaries';

/**
 * CSV rather than JSON: the stored data is a flat table of per-minute
 * readings, and CSV opens directly in Excel, Numbers and Sheets, which is what
 * a report is usually built from.
 */
const HEADERS = [
  'bucket_start_iso',
  'bucket_start_epoch_ms',
  'device_id',
  'device_name',
  'metric',
  'min_value',
  'avg_value',
  'max_value',
  'sample_count',
] as const;

/**
 * Escapes a CSV field. Quotes wrap anything containing a delimiter, quote or
 * newline, and embedded quotes are doubled, per RFC 4180.
 */
function csvField(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function summariesToCsv(summaries: Summary[]): string {
  const rows = summaries.map(summary =>
    [
      new Date(summary.bucketStart).toISOString(),
      summary.bucketStart,
      summary.deviceId,
      summary.deviceName,
      summary.metric,
      summary.min,
      summary.avg,
      summary.max,
      summary.count,
    ]
      .map(csvField)
      .join(','),
  );

  // CRLF line endings and a trailing newline keep Excel happy.
  return [HEADERS.join(','), ...rows].join('\r\n') + '\r\n';
}

function exportFileName(): string {
  // Colons are not valid in filenames on every platform, so use a compact
  // timestamp: dss-wearable-20260824-1130.csv
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `dss-wearable-${stamp}.csv`;
}

export type ExportResult =
  | { status: 'shared'; rows: number }
  | { status: 'empty' };

/**
 * Writes every stored summary to a CSV file and hands it to the system share
 * sheet, so the user can save it, mail it, or open it in a spreadsheet app.
 */
export async function exportSummariesToCsv(): Promise<ExportResult> {
  const summaries = await fetchSummaries();
  if (summaries.length === 0) return { status: 'empty' };

  // Oldest first reads more naturally in a spreadsheet than the newest-first
  // order the history view wants.
  const ordered = [...summaries].sort((first, second) => first.bucketStart - second.bucketStart);

  const file = new File(Paths.cache, exportFileName());
  // The cache directory persists between runs, so clear any previous export
  // sitting at the same path before writing.
  if (file.exists) file.delete();
  file.create();
  file.write(summariesToCsv(ordered));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export DSS Wearable data',
      UTI: 'public.comma-separated-values-text',
    });
  }

  return { status: 'shared', rows: ordered.length };
}
