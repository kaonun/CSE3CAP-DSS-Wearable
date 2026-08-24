import {useRef, useState} from 'react';
import {cancelNfcRead, readNfcTag} from './nfcService';

export function useNfc() {
  const [tagId, setTagId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRequested = useRef(false);

  const readTag = async () => {
    cancelRequested.current = false;
    setReading(true); setError(null);
    try { setTagId(await readNfcTag()); }
    catch (readError) {
      if (!cancelRequested.current) setError(readError instanceof Error ? readError.message : 'NFC read failed');
    }
    finally { setReading(false); }
  };

  const cancel = async () => {
    cancelRequested.current = true;
    await cancelNfcRead();
    setReading(false);
    setError(null);
  };

  return {tagId, reading, error, readTag, cancel};
}
