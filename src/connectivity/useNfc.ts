import {useCallback, useRef, useState} from 'react';
import {cancelNfcRead, readNfcTag} from './nfcService';

export function useNfc() {
  const [tagId, setTagId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRequested = useRef(false);
  const inFlight = useRef(false);

  // Stable identities: consumers depend on these in effects, and an unstable
  // reference there re-fires the effect on every render.
  const readTag = useCallback(async () => {
    // Guard against a double tap starting a second read while one is pending;
    // the native side rejects overlapping technology requests.
    if (inFlight.current) return;
    inFlight.current = true;
    cancelRequested.current = false;
    setReading(true);
    setError(null);
    try {
      const result = await readNfcTag();
      if (!cancelRequested.current) setTagId(result);
    } catch (readError) {
      if (!cancelRequested.current) {
        setError(readError instanceof Error ? readError.message : 'NFC read failed');
      }
    } finally {
      inFlight.current = false;
      setReading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    // Update immediately rather than awaiting the native call. Closing an NFC
    // technology request can take a moment, and blocking on it made the cancel
    // button feel unresponsive and invite repeat presses.
    cancelRequested.current = true;
    setReading(false);
    setError(null);
    void cancelNfcRead().catch(() => undefined);
  }, []);

  /** Clears the last tag so a new read starts from a blank slate. */
  const reset = useCallback(() => {
    setTagId(null);
    setError(null);
  }, []);

  return {tagId, reading, error, readTag, cancel, reset};
}
