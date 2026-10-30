// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTokenSummary } from '../../../../shared/remote-chat/client/useTokenSummary';
import type { ReadTokenSummary, TokenSummary } from '../../../../shared/remote-chat/tokenSummary';
import { TokenSummaryCache, type TokenSummaryStorage } from '../../../../shared/remote-chat/client/tokenSummaryCache';

let root: Root;
let value: ReturnType<typeof useTokenSummary>;
const snapshot = (weeks = 4): TokenSummary => ({ weeks, refreshSeconds: 1, thresholdTokens: 128000,
  startTs: 0, endTs: 1, dateKeys: [], dailyUsage: [], breakdown: [], quotaHistory: [],
  rankings: { providers: [], models: [], accounts: [] }, entryCount: 0,
  errors: { usage: false, analytics: false, quota: false } });
function Harness({ read, active = true, scope = 'test', storage }: {
  read: ReadTokenSummary; active?: boolean; scope?: string; storage?: TokenSummaryStorage;
}) {
  value = useTokenSummary({ read, active, scope, storage });
  return <button onClick={() => value.changeWeeks(1)}>最近一周</button>;
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  root = createRoot(document.createElement('div'));
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });

it('keeps refresh single-flight and stops polling while inactive', async () => {
  let resolve!: (value: TokenSummary) => void;
  const read = vi.fn<ReadTokenSummary>(() => new Promise((done) => { resolve = done; }));
  await act(async () => root.render(<Harness read={read} />));
  await act(async () => { value.refresh(); value.refresh(); await vi.advanceTimersByTimeAsync(120000); });
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => resolve(snapshot()));
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(read).toHaveBeenCalledTimes(2);
  await act(async () => root.render(<Harness read={read} active={false} />));
  await act(async () => { resolve(snapshot()); await vi.advanceTimersByTimeAsync(120000); });
  expect(read).toHaveBeenCalledTimes(2);
  expect(value.loading).toBe(false);
});

it('allows navigation during a pending read and discards the old range before applying the latest choice', async () => {
  let finish!: (value: TokenSummary) => void;
  const read = vi.fn<ReadTokenSummary>().mockImplementationOnce(() => new Promise((done) => { finish = done; }))
    .mockResolvedValue(snapshot(1));
  await act(async () => root.render(<Harness read={read} />));
  await act(async () => value.changeWeeks(1));
  expect(value.weeks).toBe(1);
  expect(value.data).toBeNull();
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => finish(snapshot(4)));
  expect(read).toHaveBeenLastCalledWith(1);
  expect(value.data?.weeks).toBe(1);
});

it('keeps errors safe and allows a retry', async () => {
  const read = vi.fn<ReadTokenSummary>().mockRejectedValueOnce(new Error('Bearer private-token'))
    .mockResolvedValue(snapshot());
  await act(async () => root.render(<Harness read={read} />));
  expect(value.error).toContain('暂时无法加载');
  expect(value.error).not.toContain('private-token');
  await act(async () => value.refresh());
  expect(value.error).toBe('');
  expect(value.data?.weeks).toBe(4);
});

it('restores the last refresh and its range after reopening, including while offline', async () => {
  const saved = { ...snapshot(3), endTs: 12345 };
  const read = vi.fn<ReadTokenSummary>().mockResolvedValue(saved);
  await act(async () => root.render(<Harness read={read} />));
  await act(async () => root.render(null));
  await act(async () => root.render(<Harness read={read} active={false} />));
  expect(value.data).toEqual(saved);
  expect(value.weeks).toBe(3);
  expect(value.loading).toBe(false);
  expect(read).toHaveBeenCalledTimes(1);

  let finish!: (data: TokenSummary) => void;
  read.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  await act(async () => root.render(<Harness read={read} />));
  expect(read).toHaveBeenLastCalledWith(3);
  expect(value.loading).toBe(true);
  expect(value.data).toEqual(saved);
  const refreshed = { ...snapshot(3), endTs: 23456 };
  await act(async () => finish(refreshed));
  await act(async () => root.render(null));
  await act(async () => root.render(<Harness read={read} active={false} />));
  expect(value.data).toEqual(refreshed);
});

it('retains cached data and its timestamp after failed refreshes and range changes', async () => {
  const saved = snapshot(2);
  await new TokenSummaryCache(localStorage, 'test').save(saved);
  const read = vi.fn<ReadTokenSummary>().mockRejectedValue(new Error('offline'));
  await act(async () => root.render(<Harness read={read} />));
  expect(value.data).toEqual(saved);
  expect(value.error).not.toBe('');
  await act(async () => value.changeWeeks(1));
  expect(value.weeks).toBe(1);
  expect(value.data).toEqual(saved);
  expect(await new TokenSummaryCache(localStorage, 'test').load()).toEqual(saved);
});

it('isolates accounts and computers and ignores a response from the previous scope', async () => {
  const saved = snapshot(3);
  await new TokenSummaryCache(localStorage, 'account:computer').save(saved);
  let finish!: (data: TokenSummary) => void;
  const read = vi.fn<ReadTokenSummary>(() => new Promise(done => { finish = done; }));
  await act(async () => root.render(<Harness read={read} scope="account:computer" />));
  expect(value.data).toEqual(saved);
  await act(async () => root.render(<Harness read={read} scope="account:other-computer" active={false} />));
  expect(value.data).toBeNull();
  await act(async () => finish(snapshot(1)));
  expect(value.data).toBeNull();
  expect(await new TokenSummaryCache(localStorage, 'account:computer').load()).toEqual(saved);
  await act(async () => root.render(<Harness read={read} scope="other-account:computer" active={false} />));
  expect(value.data).toBeNull();
});

it('waits for asynchronous native storage before requesting the saved range', async () => {
  let restore!: (saved: string | null) => void;
  const storage = { getItem: vi.fn(() => new Promise<string | null>(done => { restore = done; })),
    setItem: vi.fn(async () => {}) };
  const read = vi.fn<ReadTokenSummary>().mockResolvedValue(snapshot(5));
  await act(async () => root.render(<Harness read={read} storage={storage} />));
  expect(read).not.toHaveBeenCalled();
  await act(async () => restore(JSON.stringify(snapshot(5))));
  expect(read).toHaveBeenCalledOnce();
  expect(read).toHaveBeenLastCalledWith(5);
  expect(storage.setItem).toHaveBeenCalledOnce();
});

it('does not let late storage restore overwrite a user-selected range or a fresh response', async () => {
  let restore!: (saved: string | null) => void;
  const storage = { getItem: () => new Promise<string | null>(done => { restore = done; }),
    setItem: vi.fn(async () => {}) };
  const read = vi.fn<ReadTokenSummary>().mockResolvedValue(snapshot(1));
  await act(async () => root.render(<Harness read={read} storage={storage} />));
  await act(async () => value.changeWeeks(1));
  await act(async () => restore(JSON.stringify(snapshot(5))));
  expect(value.data?.weeks).toBe(1);
  expect(value.weeks).toBe(1);
});

it('continues refreshing when local storage is unavailable', async () => {
  const storage = { getItem: vi.fn().mockRejectedValue(new Error('unavailable')),
    setItem: vi.fn().mockRejectedValue(new Error('full')) };
  const read = vi.fn<ReadTokenSummary>().mockResolvedValue(snapshot(2));
  await act(async () => root.render(<Harness read={read} storage={storage} />));
  expect(value.data).toEqual(snapshot(2));
  expect(value.error).toBe('');
  expect(value.loading).toBe(false);
});
