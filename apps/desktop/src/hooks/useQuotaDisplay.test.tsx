// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { quotaDisplayApi, type QuotaDisplayStatus } from '../api/quotaDisplay';
import { useQuotaDisplay } from './useQuotaDisplay';
import type { AppSettings } from '../types';

vi.mock('../api/quotaDisplay', () => ({ quotaDisplayApi: {
  supported: true, load: vi.fn(), save: vi.fn(),
} }));
let root: Root;
let container: HTMLDivElement;
let latest: ReturnType<typeof useQuotaDisplay>;
function Harness() {
  latest = useQuotaDisplay();
  return <button onClick={() => void latest.update(!latest.status?.enabled)}>
    {String(latest.status?.enabled)}:{String(latest.error)}
  </button>;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(quotaDisplayApi.load).mockReset().mockResolvedValue({ enabled: false, average: null });
  vi.mocked(quotaDisplayApi.save).mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const render = () => act(async () => root.render(<Harness />));
const click = () => act(async () => container.querySelector('button')!.click());

it('saves the shared preference and then reads the new averages', async () => {
  await render();
  vi.mocked(quotaDisplayApi.save).mockResolvedValue({ quotaDisplayAllAccounts: true } as AppSettings);
  vi.mocked(quotaDisplayApi.load).mockResolvedValue({ enabled: true, average: null });
  await click();
  expect(quotaDisplayApi.save).toHaveBeenCalledWith(true);
  expect(latest.status?.enabled).toBe(true);
  expect(latest.saving).toBe(false);
});

it('keeps the previous preference when saving fails', async () => {
  await render();
  vi.mocked(quotaDisplayApi.save).mockRejectedValue(new Error('failed'));
  // The automatic retry may read the persisted false setting, but cannot turn it on.
  await click();
  expect(latest.status?.enabled).toBe(false);
  expect(latest.error).toBe(true);
});

it('does not overlap polls and ignores a pre-save response', async () => {
  await render();
  let resolve!: (status: QuotaDisplayStatus) => void;
  vi.mocked(quotaDisplayApi.load).mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(quotaDisplayApi.load).toHaveBeenCalledTimes(2);
  vi.mocked(quotaDisplayApi.save).mockResolvedValue({ quotaDisplayAllAccounts: true } as AppSettings);
  await click();
  await act(async () => resolve({ enabled: false, average: null }));
  expect(latest.status?.enabled).toBe(true);
});

it('stops polling when the display is unmounted', async () => {
  await render();
  await act(async () => root.render(null));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(quotaDisplayApi.load).toHaveBeenCalledTimes(1);
});
