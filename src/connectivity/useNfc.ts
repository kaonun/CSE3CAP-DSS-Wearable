import {useCallback, useRef, useState} from 'react';
import {cancelNfcRead, readNfcTag} from './nfcService';

export function useNfc() {
  const [tagId, setTagId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRequested = useRef(false);

  // Stable identities: consumers depend on these in effects, and an unstable
  // reference there re-fires the effect on every render.
  const readTag = useCallback(async () => {
    cancelRequested.current = false;
    setReading(true);
    setError(null);
    try {
      setTagId(await readNfcTag());
    } catch (readError) {
      if (!cancelRequested.current) {
        setError(readError instanceof Error ? readError.message : 'NFC read failed');
      }
    } finally {
      setReading(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    cancelRequested.current = true;
    await cancelNfcRead();
    setReading(false);
    setError(null);
  }, []);

  /** Clears the last tag so a new read starts from a blank slate. */
  const reset = useCallback(() => {
    setTagId(null);
    setError(null);
  }, []);

  return {tagId, reading, error, readTag, cancel, reset};
}
