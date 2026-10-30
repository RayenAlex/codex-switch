import { beforeEach, expect, it, vi } from 'vitest';
import { getDocumentAsync } from 'expo-document-picker';
import { deleteAsync, getInfoAsync, readAsStringAsync } from 'expo-file-system';
import { nativeDownloadTarget } from '../fileDownloadTarget';
import { nativeSshDownload, pickSshUpload } from './sshTransfers';
import type { SshUpload } from '../../../../../shared/terminal/sshTransfers';

vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('expo-file-system', () => ({ cacheDirectory: 'file:///cache/', EncodingType: { Base64: 'base64' },
  readAsStringAsync: vi.fn(), getInfoAsync: vi.fn(), deleteAsync: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'fixture' }));
vi.mock('../fileDownloadTarget', () => ({ nativeDownloadTarget: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

it('uploads selected files as base64 and removes only the temporary picker copy', async () => {
  vi.mocked(getDocumentAsync).mockResolvedValue({ canceled: false,
    assets: [{ name: 'hello.txt', uri: 'file:///cache/pick', size: 5 }] });
  vi.mocked(getInfoAsync).mockResolvedValue({ exists: true, isDirectory: false, size: 5,
    modificationTime: 0, uri: 'file:///cache/pick' });
  vi.mocked(readAsStringAsync).mockResolvedValue('aGVsbG8=');
  const upload = vi.fn(async (file: SshUpload) => { expect(await file.read(0, 5)).toBe('aGVsbG8='); return true; });
  await pickSshUpload(upload);
  expect(upload).toHaveBeenCalledWith(expect.objectContaining({ name: 'hello.txt', size: 5 }));
  expect(deleteAsync).toHaveBeenCalledWith('file:///cache/pick', { idempotent: true });
});

it('reads large uploads in bounded ranges and never deletes the source document', async () => {
  vi.mocked(getDocumentAsync).mockResolvedValue({ canceled: false,
    assets: [{ name: 'large.txt', uri: 'content://documents/file' }] });
  vi.mocked(getInfoAsync).mockResolvedValue({ exists: true, isDirectory: false, size: 12 * 1024 * 1024,
    modificationTime: 0, uri: 'content://documents/file' });
  const upload = vi.fn(async (file: SshUpload) => { await file.read(262144, 262144); return true; });
  await pickSshUpload(upload);
  expect(upload).toHaveBeenCalledOnce();
  expect(readAsStringAsync).toHaveBeenCalledWith('content://documents/file',
    { encoding: 'base64', position: 262144, length: 262144 });
  expect(deleteAsync).not.toHaveBeenCalled();
});

it('publishes downloads through native storage and cleans up after a failed save', async () => {
  const target = { write: vi.fn(async () => {}), finish: vi.fn(async () => { throw new Error('failed'); }),
    dispose: vi.fn(async () => {}) };
  vi.mocked(nativeDownloadTarget).mockResolvedValue(target);
  await expect(nativeSshDownload({ name: 'hello.txt', path: '/hello.txt', directory: false, size: 5 }, 'aGVsbG8='))
    .rejects.toThrow('failed');
  expect(target.write).toHaveBeenCalledWith('aGVsbG8=');
  expect(target.dispose).toHaveBeenCalledOnce();
  await expect(nativeSshDownload({ name: '../escape', path: '/', directory: false, size: 5 }, 'aGVsbG8='))
    .rejects.toThrow('client.ssh.invalidName');
  expect(nativeDownloadTarget).toHaveBeenCalledTimes(1);
});
