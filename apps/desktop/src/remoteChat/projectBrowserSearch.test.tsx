// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProjectTreeSearch } from '../../../../shared/project-browser/useProjectTreeSearch';
import { createProjectBrowserClient, type ProjectBrowserClient } from '../../../../shared/project-browser/protocol';
import type { ProjectFilesResponse } from '../../../../shared/remote-chat/projectFiles';

let root: Root;
let client: ProjectBrowserClient;
let search: ReturnType<typeof useProjectTreeSearch>;
const response = (name: string, truncated = false): ProjectFilesResponse => ({ directory: '/project', parent: null,
  entries: [{ name, path: `/project/${name}`, directory: false }], truncated });
function Fixture({ cwd = '/project', connected = true }) {
  search = useProjectTreeSearch(client, cwd, connected);
  return null;
}
const settle = () => act(async () => vi.advanceTimersByTimeAsync(250));
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  client = { list: vi.fn().mockResolvedValue(response('match')), read: vi.fn(), save: vi.fn(), mutate: vi.fn() };
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Fixture />));
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('debounces typing, searches the project and clears results immediately', async () => {
  act(() => search.change('m'));
  act(() => search.change(' match '));
  expect(search.loading).toBe(true);
  expect(client.list).not.toHaveBeenCalled();
  await settle();
  expect(client.list).toHaveBeenCalledExactlyOnceWith('/project', undefined, 'match');
  expect(search.entries[0].name).toBe('match');
  act(() => search.change(''));
  expect(search.active).toBe(false);
  expect(search.entries).toEqual([]);
  await settle();
  expect(client.list).toHaveBeenCalledTimes(1);
});

it('serializes requests and ignores late results after the query changes', async () => {
  let finish!: (value: ProjectFilesResponse) => void;
  vi.mocked(client.list).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  act(() => search.change('old'));
  await settle();
  act(() => search.change('new'));
  await settle();
  expect(client.list).toHaveBeenCalledTimes(1);
  await act(async () => finish(response('old')));
  expect(client.list).toHaveBeenLastCalledWith('/project', undefined, 'new');
  expect(search.entries[0].name).toBe('match');
});

it('hides results on disconnect, reloads on reconnect and resets the query for another project', async () => {
  act(() => search.change('match'));
  await settle();
  await act(async () => root.render(<Fixture connected={false} />));
  expect(search.entries).toEqual([]);
  await act(async () => root.render(<Fixture />));
  await settle();
  expect(client.list).toHaveBeenCalledTimes(2);
  await act(async () => root.render(<Fixture cwd="/other" />));
  expect(search.query).toBe('');
  expect(search.entries).toEqual([]);
});

it('reports failure and partial results, and refreshes after a retry or file change', async () => {
  vi.mocked(client.list).mockRejectedValueOnce(new Error('private filesystem error'));
  act(() => search.change('match'));
  await settle();
  expect(search.failed).toBe(true);
  vi.mocked(client.list).mockResolvedValueOnce(response('match', true));
  act(() => search.refresh());
  await settle();
  expect(search.failed).toBe(false);
  expect(search.truncated).toBe(true);
  act(() => search.refresh());
  expect(search.entries).toEqual([]);
  await settle();
  expect(client.list).toHaveBeenCalledTimes(3);
});

it('keeps normal browsing requests unchanged and includes all directories for browser searches', async () => {
  const request = vi.fn().mockResolvedValue(response('match'));
  const browser = createProjectBrowserClient(request);
  await browser.list('/project', '/project/src');
  expect(request).toHaveBeenLastCalledWith({ operation: 'projectFiles', cwd: '/project', directory: '/project/src' });
  await browser.list('/project', undefined, 'main.ts');
  expect(request).toHaveBeenLastCalledWith({ operation: 'projectFiles', cwd: '/project', directory: undefined,
    query: 'main.ts', searchAllDirectories: true });
});
