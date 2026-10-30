import { useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, deleteAsync, EncodingType, getInfoAsync, readAsStringAsync } from 'expo-file-system';
import { fromByteArray, toByteArray } from 'base64-js';
import { randomUUID } from 'expo-crypto';
import { nativeDownloadTarget } from '../fileDownloadTarget';
import type { ZmodemFile, ZmodemState, ZmodemTransfer } from '../../../../../shared/terminal/zmodem';

interface Download { name: string; chunks: Uint8Array[]; saved?: boolean }

export function useZmodemFiles() {
  const [state, setState] = useState<ZmodemState>();
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const handlers = useMemo(() => ({
    change: (next: ZmodemState | undefined) => {
      setState(next);
      if (next?.phase === 'offer') { setDownloads([]); setError(''); }
    },
    file: (name: string, chunks: Uint8Array[]) => setDownloads(previous => [...previous, { name, chunks }]),
  }), []);
  return { handlers, state, downloads, saving, error,
    dismiss: () => { setState(undefined); setDownloads([]); setError(''); },
    select: async (transfer: ZmodemTransfer) => {
      try { await transfer.prepareUpload(); await selectFiles(files => transfer.accept(files)); }
      catch { setError('client.ssh.fileFailed'); }
    },
    save: async (index: number) => {
      if (saving) return;
      setSaving(true); setError('');
      try {
        await saveFile(downloads[index]);
        setDownloads(previous => previous.map((file, position) => position === index
          ? { ...file, saved: true, chunks: [] } : file));
      } catch { setError('client.ssh.fileFailed'); }
      finally { setSaving(false); }
    },
  };
}

async function selectFiles(accept: (files: ZmodemFile[]) => Promise<void>) {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
  if (result.canceled) return;
  try {
    const files = await Promise.all(result.assets.map(async file => {
      const info = await getInfoAsync(file.uri);
      if (!info.exists || info.isDirectory) throw new Error('client.ssh.fileFailed');
      return { name: file.name, size: info.size,
        read: async (position: number, length: number) => toByteArray(await readAsStringAsync(file.uri,
          { encoding: EncodingType.Base64, position, length })) };
    }));
    await accept(files);
  } finally {
    for (const file of result.assets) {
      if (cacheDirectory && file.uri.startsWith(cacheDirectory)) await deleteAsync(file.uri, { idempotent: true });
    }
  }
}

async function saveFile(file: Download) {
  const target = await nativeDownloadTarget({ id: randomUUID(), name: file.name,
    size: file.chunks.reduce((size, chunk) => size + chunk.length, 0), mimeType: 'application/octet-stream' });
  try {
    for (const chunk of file.chunks) await target.write(fromByteArray(chunk));
    await target.finish();
  } finally { await target.dispose(); }
}
