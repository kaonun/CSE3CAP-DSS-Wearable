import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { useI18n, type Messages } from '@/i18n';

/**
 * Compact duration: seconds below a minute, minutes below an hour, then hours
 * and minutes. Only the largest two units are shown, so the label stays short
 * enough to sit under a timestamp without crowding it.
 */
export function formatDuration(ms: number, t: Messages): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));

  if (totalSeconds < 60) {
    return t.durationSeconds.replace('{v}', String(totalSeconds));
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return t.durationMinutes.replace('{v}', String(totalMinutes));
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hoursLabel = t.durationHours.replace('{v}', String(hours));
  return minutes === 0
    ? hoursLabel
    : `${hoursLabel} ${t.durationMinutes.replace('{v}', String(minutes))}`;
}

/**
 * How long a session lasted, ticking while it is still open.
 *
 * Kept as its own component so the per-second re-render stays here rather than
 * refreshing the whole screen.
 */
export function SessionDuration({
  connectedAt,
  disconnectedAt,
}: {
  connectedAt: number;
  disconnectedAt: number | null;
}) {
  const { t } = useI18n();
  const live = disconnectedAt === null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  const elapsed = (live ? now : disconnectedAt) - connectedAt;

  return (
    <ThemedText type="caption" themeColor="textTertiary">
      {formatDuration(elapsed, t)}
    </ThemedText>
  );
}
