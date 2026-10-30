import { expect, it, vi } from 'vitest';
import type { SshApi, SshFileReply } from '../../../../shared/terminal/ssh';
import { SSH_UPLOAD_CHUNK_BYTES, SshUploadCancelled, uploadSshFile } from '../../../../shared/terminal/sshUpload';

function fixture(size = 8 * 1024 * 1024 + 7) {
  const controller = new AbortController();
  const api: SshApi = { probe: vi.fn(), open: vi.fn(), profiles: { list: vi.fn(), save: vi.fn(), remove: vi.fn() },
    files: vi.fn(async (_id, action): Promise<SshFileReply> => {
      if (action.type === 'uploadStart') return { type: 'upload', token: 'test-upload' };
      if (action.type === 'uploadFinish') return { type: 'uploaded', path: '/large.bin' };
      return { type: 'done' };
    }) };
  const file = { name: 'large.bin', size, read: vi.fn(async (_offset: number, length: number) =>
    Buffer.alloc(length, 0x6b).toString('base64')) };
  return { api, file, controller, options: { api, file, id: 'ssh-test', path: '/large.bin', signal: controller.signal,
    progress: vi.fn() } };
}

it('uploads files above 4 MB with bounded sequential reads and completes only after all bytes', async () => {
  const f = fixture();
  expect(await uploadSshFile(f.options)).toBe('/large.bin');
  expect(f.file.read).toHaveBeenCalledTimes(33);
  expect(f.file.read).toHaveBeenLastCalledWith(8 * 1024 * 1024, 7);
  expect(f.file.read.mock.calls.every(([, length]) => length <= SSH_UPLOAD_CHUNK_BYTES)).toBe(true);
  expect(f.options.progress).toHaveBeenLastCalledWith({ name: 'large.bin', sent: f.file.size, total: f.file.size });
  expect(f.api.files).toHaveBeenLastCalledWith('ssh-test', { type: 'uploadFinish', token: 'test-upload' });
});

it.each(['overwrite', 'rename'] as const)('asks before resolving an existing file with %s', async choice => {
  const f = fixture(0);
  vi.mocked(f.api.files).mockRejectedValueOnce(new Error('client.ssh.conflict'));
  const resolveConflict = vi.fn(async () => choice);
  await uploadSshFile({ ...f.options, resolveConflict });
  expect(resolveConflict).toHaveBeenCalledExactlyOnceWith('large.bin');
  expect(f.api.files).toHaveBeenNthCalledWith(2, 'ssh-test', { type: 'uploadStart', path: '/large.bin', size: 0,
    mode: choice });
  expect(f.file.read).not.toHaveBeenCalled();
});

it('cancels on the conflict prompt without reading or replacing anything', async () => {
  const f = fixture();
  vi.mocked(f.api.files).mockRejectedValueOnce(new Error('client.ssh.conflict'));
  await expect(uploadSshFile({ ...f.options, resolveConflict: async () => undefined })).rejects.toBeInstanceOf(
    SshUploadCancelled);
  expect(f.file.read).not.toHaveBeenCalled(); expect(f.api.files).toHaveBeenCalledOnce();
});

it('cleans up an interrupted upload, including uploads larger than the 32-bit range', async () => {
  const f = fixture(5 * 1024 ** 3);
  f.file.read.mockImplementationOnce(async (_offset, length) => {
    f.controller.abort(); return Buffer.alloc(length).toString('base64');
  });
  await expect(uploadSshFile(f.options)).rejects.toBeInstanceOf(SshUploadCancelled);
  expect(f.api.files).toHaveBeenLastCalledWith('ssh-test', { type: 'uploadCancel', token: 'test-upload' });
  expect(f.api.files).toHaveBeenCalledTimes(2);
});

it('rejects short source reads and cancels the temporary file', async () => {
  const f = fixture(12);
  f.file.read.mockResolvedValue(Buffer.from('short').toString('base64'));
  await expect(uploadSshFile(f.options)).rejects.toThrow('client.ssh.fileFailed');
  expect(f.api.files).toHaveBeenLastCalledWith('ssh-test', { type: 'uploadCancel', token: 'test-upload' });
});

it('handles a destination created during upload by cancelling and asking again', async () => {
  const f = fixture(1);
  const send = vi.mocked(f.api.files).getMockImplementation()!;
  let finish = 0;
  vi.mocked(f.api.files).mockImplementation(async (id, action) => {
    if (action.type === 'uploadFinish' && finish++ === 0) throw new Error('client.ssh.conflict');
    return send(id, action);
  });
  const resolveConflict = vi.fn(async () => 'rename' as const);
  await uploadSshFile({ ...f.options, resolveConflict });
  expect(f.api.files).toHaveBeenCalledWith('ssh-test', { type: 'uploadCancel', token: 'test-upload' });
  expect(resolveConflict).toHaveBeenCalledOnce(); expect(f.file.read).toHaveBeenCalledTimes(2);
});
