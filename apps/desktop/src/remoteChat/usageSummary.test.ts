import { expect, it } from 'vitest';
import { decodeUsageSummary } from '../../../../shared/remote-chat/usageSummary';
import { usageTrailing } from '../../../../shared/remote-chat/usage';

const totals = { totalTokens: 1_520, estimatedCostUsd: 2.5 };

it.each([undefined, null, false, 0, 'usage', [], {}, { totalTokens: 0 }, { estimatedCostUsd: 0 }])(
  'rejects missing usage totals: %j', value => {
    expect(() => decodeUsageSummary(value)).toThrow('Invalid usage summary');
  },
);

it.each([undefined, null, '1500', false, {}, [], -1, NaN, Infinity, -Infinity])(
  'rejects malformed required numbers without coercion: %j', value => {
    for (const key of ['totalTokens', 'estimatedCostUsd']) {
      expect(() => decodeUsageSummary({ ...totals, [key]: value })).toThrow('Invalid usage summary');
    }
  },
);

it('accepts zero usage and older hosts without optional fields', () => {
  expect(decodeUsageSummary({ totalTokens: 0, estimatedCostUsd: 0 })).toEqual({
    totalTokens: 0, estimatedCostUsd: 0, primaryRemainingPercent: null,
    primaryRemainingAggregated: false, providerEstimatedCost: null,
  });
});

it.each([undefined, null, '10', false, {}, [], -1, NaN, Infinity])(
  'omits invalid optional quota and cost numbers: %j', value => {
    const usage = decodeUsageSummary({ ...totals, primaryRemainingPercent: value,
      providerEstimatedCost: { amountUsd: value, aggregated: true } });
    expect(usage).toMatchObject({ ...totals, primaryRemainingPercent: null, providerEstimatedCost: null });
    expect(usageTrailing(usage)).toBeNull();
  },
);

it.each([null, false, 1, 'API', [], {}])('omits malformed API estimate objects: %j', providerEstimatedCost => {
  expect(decodeUsageSummary({ ...totals, providerEstimatedCost }).providerEstimatedCost).toBeNull();
});

it('preserves aggregate quotas above 100 percent and zero cost estimates', () => {
  const usage = { ...totals, primaryRemainingPercent: 175, primaryRemainingAggregated: true,
    providerEstimatedCost: { amountUsd: 0, aggregated: true } };
  expect(decodeUsageSummary(usage)).toEqual(usage);
  expect(decodeUsageSummary({ ...usage, primaryRemainingPercent: 0 }).primaryRemainingPercent).toBe(0);
  expect(decodeUsageSummary({ ...totals, primaryRemainingAggregated: 'false',
    providerEstimatedCost: { amountUsd: 2, aggregated: 'true' } })).toMatchObject({
    primaryRemainingAggregated: false, providerEstimatedCost: { amountUsd: 2, aggregated: false },
  });
});

it('passes through the PC quota estimate without deriving it from today’s cost or percentage', () => {
  const usage = decodeUsageSummary({ ...totals, primaryRemainingPercent: 80,
    estimatedQuota: { remainingUsd: 20, capacityUsd: 200 } });
  expect(usage.estimatedQuota).toEqual({ remainingUsd: 20, capacityUsd: 200 });
  expect(usageTrailing(usage)?.quota).toMatchObject({ remaining: '20USD 剩余额度', total: '200USD 总额度' });
  const empty = decodeUsageSummary({ ...totals, primaryRemainingPercent: 0,
    estimatedQuota: { remainingUsd: 0, capacityUsd: null } });
  expect(usageTrailing(empty)?.quota).toMatchObject({ remaining: '0USD 剩余额度', total: '— 总额度' });
});

it.each([null, {}, { remainingUsd: -1 }, { remainingUsd: Infinity }, { remainingUsd: '20' }])(
  'leaves malformed estimates unavailable: %j', estimatedQuota => {
    expect(decodeUsageSummary({ ...totals, estimatedQuota }).estimatedQuota).toBeUndefined();
  },
);

it('does not present invalid or smaller total capacities as known estimates', () => {
  for (const capacityUsd of [NaN, -1, 10, '100']) {
    expect(decodeUsageSummary({ ...totals, estimatedQuota: { remainingUsd: 20, capacityUsd } }).estimatedQuota)
      .toEqual({ remainingUsd: 20, capacityUsd: null });
  }
});
