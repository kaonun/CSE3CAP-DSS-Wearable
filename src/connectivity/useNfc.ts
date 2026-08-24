import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
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

  /**
   * Release the NFC radio whenever this screen goes away or the app leaves the
   * foreground. An open technology request suspends the system's own tag
   * discovery, so if the process is killed while one is pending — which is
   * exactly what happens after backgrounding — the phone stops detecting tags
   * entirely, with no prompt and no vibration, until NFC is toggled.
   */
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined;

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // Came straight back — this was a blip, not a real backgrounding.
        if (pending) clearTimeout(pending);
        pending = undefined;
        return;
      }
      // Only 'background' counts, and only if it sticks. Detecting a tag makes
      // the activity pause briefly, and cancelling on that transition killed
      // the very read the tag was meant to complete.
      if (state !== 'background' || pending) return;
      pending = setTimeout(() => {
        pending = undefined;
        cancelRequested.current = true;
        setReading(false);
        void cancelNfcRead().catch(() => undefined);
      }, 1500);
    });

    return () => {
      subscription.remove();
      if (pending) clearTimeout(pending);
      cancelRequested.current = true;
      void cancelNfcRead().catch(() => undefined);
    };
  }, []);

  return {tagId, reading, error, readTag, cancel, reset};
}
