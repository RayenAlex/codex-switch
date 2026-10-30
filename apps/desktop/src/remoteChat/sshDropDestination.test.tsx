// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { SshDropTarget, type SshNativeDrop } from '../../../../shared/terminal/SshDropTarget';
import { sshDropDirectory } from '../../../../shared/terminal/sshDrop';
import type { FileDropEvent } from '../../../../shared/chat/useFileDrop';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([
  { directory: true, path: '/home/子目录', expected: '/home/子目录' },
  { directory: false, path: '/home/子目录/file.txt', expected: '/home/子目录' },
  { directory: false, path: '/file.txt', expected: '/' },
])('resolves a nested row element to $expected', ({ directory, path, expected }) => {
  const row = document.createElement('button');
  row.className = 'pf-tree-row'; row.dataset.path = path; row.dataset.directory = String(directory);
  const icon = document.createElement('span'); row.append(icon);
  expect(sshDropDirectory(icon, '/home')).toBe(expected);
});

it('uses the current folder for blank space and elements outside file rows', () => {
  expect(sshDropDirectory(null, '/home')).toBe('/home');
  expect(sshDropDirectory(document.createElement('div'), '/home')).toBe('/home');
});

it('uses scaled native drop coordinates and preserves the directory while opening local files', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('devicePixelRatio', 2);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  let listener!: (event: FileDropEvent) => void;
  let finish!: (batch: Awaited<ReturnType<SshNativeDrop['read']>>) => void;
  const upload = vi.fn(async () => {});
  const release = vi.fn(async () => {});
  const source: SshNativeDrop = { subscribe: async callback => { listener = callback; return () => {}; },
    read: () => new Promise(resolve => { finish = resolve; }) };
  try {
    await act(async () => root.render(<SshDropTarget id="ssh" path="/home" active native={source}
      upload={upload} report={vi.fn()} resolveDirectory={target => sshDropDirectory(target, '/home')}>
      <button className="pf-tree-row" data-path="/home/nested/file.txt" data-directory="false"><span /></button>
    </SshDropTarget>));
    vi.spyOn(host.firstElementChild!, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}),
    });
    const hitTest = vi.fn(() => host.querySelector('span'));
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: hitTest });
    await act(async () => listener({ type: 'over', position: { x: 40, y: 60 } }));
    expect(hitTest).toHaveBeenCalledWith(20, 30);
    expect(host.querySelector('.ssh-drop-overlay')?.textContent).toContain('/home/nested');
    await act(async () => listener({ type: 'drop', position: { x: 40, y: 60 }, paths: ['C:/file.txt'] }));
    host.querySelector('button')!.dataset.path = '/elsewhere/file.txt';
    await act(async () => finish({ files: [], release }));
    expect(upload).toHaveBeenCalledWith({ files: [], release, directory: '/home/nested' });
  } finally {
    await act(async () => root.unmount()); host.remove();
    Reflect.deleteProperty(document, 'elementFromPoint');
  }
});
