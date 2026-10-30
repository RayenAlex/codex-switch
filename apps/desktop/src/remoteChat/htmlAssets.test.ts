// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { prepareHtmlPreview, htmlFileUrl } from '../../../../shared/file-preview/htmlAssets';
import { chatPreviewLoader } from '../../../../shared/file-preview/chatLoader';
import type { PreviewLoader } from '../../../../shared/file-preview/kinds';

function blob(text: string, type: string) {
  const result = new Blob([text], { type });
  // jsdom's FileReader supports Blob, but its Blob does not yet implement text().
  Object.assign(result, { text: async () => text });
  return result;
}
const signal = () => new AbortController().signal;

it('resolves Windows, POSIX, encoded and parent paths without treating query strings as filenames', async () => {
  const load = vi.fn<PreviewLoader>(async () => blob('image', 'image/png'));
  const result = await prepareHtmlPreview({ path: 'D:\\project folder\\review\\index.html', signal: signal(), load,
    text: '<img src="../before%20image.png?v=2"><img src="D:/project%20folder/after.png">'
      + '<img src="https://example.com/a.png"><img src="data:image/png;base64,YQ==">' });
  expect(load.mock.calls.map(([path]) => path)).toEqual(['D:/project folder/before image.png',
    'D:/project%20folder/after.png']);
  expect(result.html).toContain('https://example.com/a.png');
  expect(result.html).not.toContain('src="../');
  expect(htmlFileUrl('/project/文件 #1.html').pathname).toBe('/project/%E6%96%87%E4%BB%B6%20%231.html');
  expect(result.failed).toBe(false);
});

it('resolves local bases, deduplicates resources, and terminates circular CSS imports', async () => {
  const load = vi.fn<PreviewLoader>(async path => path.endsWith('.css')
    ? blob('@import "theme.css"; body{background:url(image.png)}', 'text/css') : blob('image', 'image/png'));
  const result = await prepareHtmlPreview({ path: '/project/index.html', load, signal: signal(),
    text: '<base href="assets/"><link rel="stylesheet" href="theme.css"><img src="image.png">'
      + '<img srcset="image.png 1x, image.png 2x">' });
  expect(load.mock.calls.map(([path]) => path)).toEqual(['/project/assets/theme.css', '/project/assets/image.png']);
  expect(result.html).not.toContain('<base');
  expect(result.failed).toBe(false);
});

it('keeps readable content when assets fail and never retries them against the app server', async () => {
  const load = vi.fn<PreviewLoader>().mockRejectedValue(new Error('Private path'));
  const result = await prepareHtmlPreview({ path: '/project/index.html', load, signal: signal(),
    text: '<h1>Report</h1><img src="missing.png"><img src="missing.png">' });
  expect(result.failed).toBe(true);
  expect(result.html).toContain('<h1>Report</h1>');
  expect(result.html).toContain('src="data:,"');
  expect(result.html).not.toContain('Private path');
  expect(load).toHaveBeenCalledTimes(1);
});

it('preserves remote base URLs without reading their assets from the selected computer', async () => {
  const load = vi.fn<PreviewLoader>();
  const result = await prepareHtmlPreview({ path: '/project/index.html', load, signal: signal(),
    text: '<base href="https://example.com/review/"><img src="../image.png">' });
  expect(result.html).toContain('src="https://example.com/image.png"');
  expect(load).not.toHaveBeenCalled();
});

it('stops preparing a superseded preview before loading subsequent resources', async () => {
  const controller = new AbortController();
  const load = vi.fn<PreviewLoader>(async () => { controller.abort(); return blob('image', 'image/png'); });
  await expect(prepareHtmlPreview({ path: '/index.html', load, signal: controller.signal,
    text: '<img src="a.png"><img src="b.png">' })).rejects.toThrow();
  expect(load).toHaveBeenCalledTimes(1);
});

it('closes a remote file session even if its resource read fails', async () => {
  const client = { open: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111',
    size: 3, name: 'a.png', mimeType: 'image/png' })),
  read: vi.fn().mockRejectedValue(new Error('Disconnected')), close: vi.fn(async () => {}) };
  await expect(chatPreviewLoader(client, 'remote-thread')('/a.png', { signal: signal(), progress: () => {} }))
    .rejects.toThrow('Disconnected');
  expect(client.close).toHaveBeenCalledWith('remote-thread', '11111111-1111-4111-8111-111111111111');
});
