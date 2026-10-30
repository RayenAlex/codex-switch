import { fromByteArray, toByteArray } from 'base64-js';
import { browserRequest } from './project-browser-fixture';
import type { ProjectBrowserRequest } from '../../../shared/project-browser/protocol';
import type { ProjectFilesResponse } from '../../../shared/remote-chat/projectFiles';
import { previewMimeType, filePreviewKind } from '../../../shared/file-preview/kinds';

const files = new Map<string, Uint8Array>();
const transfers = new Map<string, string>();
export const previewReads: object[] = [];
export function setPreviewFiles(values: Record<string, string>) {
  for (const [name, base64] of Object.entries(values)) files.set(name, toByteArray(base64));
}

interface Request { operation: string; path?: string; cwd?: string; directory?: string;
  id?: string; offset?: number; length?: number }

export async function previewBrowserRequest<T>(request: Request): Promise<T> {
  const name = request.path?.split('/').at(-1) ?? '';
  const bytes = files.get(name);
  if (request.operation === 'projectFiles' && (!request.directory || request.directory === request.cwd)) {
    const result = await browserRequest<ProjectFilesResponse>(request as ProjectBrowserRequest);
    return { ...result, entries: [...result.entries, ...[...files.keys()].map(name => ({ name,
      path: `${request.cwd}/${name}`, directory: false }))] } as T;
  }
  if (request.operation === 'projectFileRead' && bytes) {
    const kind = filePreviewKind(name);
    const text = kind === 'markdown' || kind === 'html';
    const inlineImage = kind === 'image' && new URLSearchParams(location.search).has('inlineImages');
    if (inlineImage) return { path: request.path, kind: 'image', size: bytes.length, readOnly: true,
      image: `data:${previewMimeType(name)};base64,${fromByteArray(bytes)}`, revision: 'fixture' } as T;
    return { path: request.path, kind: text ? 'text' : 'binary', size: bytes.length,
      text: text ? new TextDecoder().decode(bytes) : undefined, readOnly: !text, revision: 'fixture' } as T;
  }
  if (request.operation === 'downloadOpen' && bytes) {
    const id = crypto.randomUUID(); transfers.set(id, name);
    return { id, size: bytes.length, name, mimeType: previewMimeType(name) } as T;
  }
  if (request.operation === 'fileRead') {
    previewReads.push(request);
    const data = files.get(transfers.get(request.id!)!)!;
    return { offset: request.offset,
      data: fromByteArray(data.subarray(request.offset!, request.offset! + request.length!)) } as T;
  }
  if (request.operation === 'fileClose') { transfers.delete(request.id!); return undefined as T; }
  return browserRequest<T>(request as ProjectBrowserRequest);
}
