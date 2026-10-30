// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { ChatOperations } from './operations';
import { RemoteTerminals } from './terminals';

afterEach(() => vi.restoreAllMocks());

it('deduplicates SSH opens without retaining credentials and rejects changed retry payloads', async () => {
  const terminals = new RemoteTerminals();
  const open = vi.spyOn(terminals, 'request').mockResolvedValue({ id: 'ssh-test', cwd: '', shell: 'SSH' });
  const operations = new ChatOperations(terminals);
  const request = { kind: 'request' as const, id: 'open', method: 'request' as const,
    body: { operation: 'guiTerminalSshOpen', cwd: '/project', request: { password: 'test-secret' } } };
  const [first, retry] = await Promise.all([operations.execute(request), operations.execute(request)]);
  expect(first).toEqual(retry);
  expect(open).toHaveBeenCalledTimes(1);
  // Inspect retained state because deduplication alone cannot detect plaintext credential retention.
  const cache = Reflect.get(operations, 'cache') as Map<string, unknown>;
  expect(JSON.stringify([...cache.values()])).not.toContain('test-secret');
  await expect(operations.execute({ ...request,
    body: { ...request.body, request: { password: 'changed-secret' } } })).rejects.toThrow('Request id reused');
  await operations.execute(request);
  expect(open).toHaveBeenCalledTimes(1);
});

it.each(['read', 'readChunk', 'list', 'uploadChunk'])(
  'releases completed SFTP %s payloads but retains legacy upload acknowledgements', async type => {
  const terminals = new RemoteTerminals();
  const files = vi.spyOn(terminals, 'request').mockResolvedValue({ type: 'file', data: 'private-data' });
  const operations = new ChatOperations(terminals);
  const request = { kind: 'request' as const, id: 'file', method: 'request' as const,
    body: { operation: 'guiTerminalSshFiles', id: 'ssh-test', request: { type, path: '/file' } } };
  await operations.execute(request);
  await operations.execute(request);
  expect(files).toHaveBeenCalledTimes(2);
  files.mockResolvedValue({ type: 'done' });
  const upload = { ...request, id: 'upload', body: { ...request.body,
    request: { type: 'upload', path: '/new', data: 'private-upload-data' } } };
  await operations.execute(upload);
  await operations.execute(upload);
  expect(files).toHaveBeenCalledTimes(3);
  const cache = Reflect.get(operations, 'cache') as Map<string, unknown>;
  expect(JSON.stringify([...cache.values()])).not.toContain('private-upload-data');
});
