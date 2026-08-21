import {useState} from 'react';
import {readNfcTag} from './nfcService';

export function useNfc() {
  const [tagId, setTagId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readTag = async () => {
    setReading(true); setError(null);
    try { setTagId(await readNfcTag()); }
    catch (readError) { setError(readError instanceof Error ? readError.message : 'NFC read failed'); }
    finally { setReading(false); }
  };

  return {tagId, reading, error, readTag};
}
