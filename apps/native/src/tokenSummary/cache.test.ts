import { expect, it } from 'vitest';
import { TokenSummaryCache } from '../../../../shared/remote-chat/client/tokenSummaryCache';
import type { TokenSummary } from '../../../../shared/remote-chat/tokenSummary';

const snapshot: TokenSummary = { weeks: 3, refreshSeconds: 60, thresholdTokens: 128000,
  startTs: 100, endTs: 200, dateKeys: [], dailyUsage: [], breakdown: [],
  quotaHistory: [{ accountId: 'account', accountLabel: 'Account', points: [100, 110].map(ts => ({
    ts, primaryRemainingPercent: 80, secondaryRemainingPercent: 50, primaryResetAt: 300, secondaryResetAt: 400,
  })) }],
  rankings: { providers: [['Provider', 1000]], models: [], accounts: [] }, entryCount: 1,
  errors: { usage: false, analytics: false, quota: false } };

it('restores the complete latest snapshot from asynchronous storage across cache instances', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); } };
  const cache = new TokenSummaryCache(storage, 'account:computer');
  await cache.save(snapshot);
  expect(await new TokenSummaryCache(storage, 'account:computer').load()).toEqual(snapshot);
  expect(await new TokenSummaryCache(storage, 'other:computer').load()).toBeNull();
  const latest = { ...snapshot, endTs: 300, weeks: 4 };
  await cache.save(latest);
  expect(values.size).toBe(1);
  expect(await new TokenSummaryCache(storage, 'account:computer').load()).toEqual(latest);
});

it.each(['{broken', 'null', '{}', JSON.stringify({ ...snapshot, weeks: 53 }),
  JSON.stringify({ ...snapshot, rankings: null }),
  JSON.stringify({ ...snapshot, quotaHistoryFormat: 'future-version' }),
])('ignores incompatible or damaged cached data: %s', async saved => {
  const cache = new TokenSummaryCache({ getItem: async () => saved, setItem: async () => {} }, 'test');
  expect(await cache.load()).toBeNull();
});

it('serializes asynchronous writes so an earlier refresh cannot overwrite the latest', async () => {
  let saved: string | null = null;
  const writes: Array<() => void> = [];
  const cache = new TokenSummaryCache({ getItem: async () => saved,
    setItem: async (_key, value) => new Promise<void>(done => {
      writes.push(() => { saved = value; done(); });
    }) }, 'test');
  const first = cache.save(snapshot);
  const latest = { ...snapshot, endTs: 300 };
  const second = cache.save(latest);
  await Promise.resolve();
  expect(writes).toHaveLength(1);
  writes[0]();
  await first;
  expect(writes).toHaveLength(2);
  writes[1]();
  await second;
  expect(await cache.load()).toEqual(latest);
});
