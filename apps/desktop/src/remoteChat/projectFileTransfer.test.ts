import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readProjectDocument, saveProjectDocument } from '../../../../shared/project-browser/fileTransfer';
import { PROJECT_FILE_CHUNK_BYTES, type ProjectBrowserRequest } from '../../../../shared/project-browser/protocol';

const revision = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const target = { cwd: '/project', path: '/project/large.ts' };

it('reassembles UTF-8 across packet boundaries and rejects content changed during the read', async () => {
  const bytes = Buffer.from('中'.repeat(PROJECT_FILE_CHUNK_BYTES));
  let corrupt = false;
  const request = async <T,>(input: ProjectBrowserRequest): Promise<T> => {
    if (input.operation !== 'projectFileRead') throw new Error('unexpected write');
    if (!input.chunk) return { ...target, kind: 'text', size: bytes.length, chunked: true,
      revision: revision(bytes), readOnly: false } as T;
    const chunk = Buffer.from(bytes.subarray(input.chunk.offset, input.chunk.offset + input.chunk.length));
    if (corrupt) chunk[0] = 1;
    return { data: chunk.toString('base64') } as T;
  };
  expect((await readProjectDocument(request, target)).text).toBe(bytes.toString());
  corrupt = true;
  await expect(readProjectDocument(request, target)).rejects.toThrow('ChangedElsewhere');
});

it('chunks writes, returns the complete saved baseline and cancels failed staging', async () => {
  const text = '你好\r\n'.repeat(PROJECT_FILE_CHUNK_BYTES);
  const chunks: Buffer[] = [];
  let fail = false;
  let cancelled = false;
  const request = async <T,>(input: ProjectBrowserRequest): Promise<T> => {
    if (input.operation !== 'projectFileWrite' || !('upload' in input)) throw new Error('expected chunk');
    const upload = input.upload;
    if (upload.cancel) { cancelled = true; return null as T; }
    const bytes = Buffer.from(upload.data, 'base64');
    expect(bytes.length).toBeLessThanOrEqual(PROJECT_FILE_CHUNK_BYTES);
    if (fail) throw new Error('disconnected');
    chunks.push(bytes);
    return { ...target, kind: 'text', readOnly: false, revision: 'saved', chunked: true } as T;
  };
  expect((await saveProjectDocument(request, { ...target, text, revision: 'original' })).text).toBe(text);
  expect(Buffer.concat(chunks).toString()).toBe(text);
  fail = true;
  await expect(saveProjectDocument(request, { ...target, text, revision: 'original' })).rejects.toThrow('disconnected');
  expect(cancelled).toBe(true);
});
