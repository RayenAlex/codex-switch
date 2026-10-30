import { expect, it } from 'vitest';
import { formatCompactTokens, formatUsageUsd } from '../../../../shared/remote-chat/usageAmounts';

it.each([
  [0, '0.00'], [12.3, '12.30'], [999, '999.00'], [1000, '1.00 K'],
  [2500, '2.50 K'], [999000, '999.00 K'], [1000000, '1.00 M'], [2012345, '2.01 M'],
  [undefined, '—'], [null, '—'], [NaN, '—'], [Infinity, '—'], [-1, '—'],
])('formats current and daily token usage %s as %s', (value, expected) => {
  expect(formatCompactTokens(value)).toBe(expected);
});

it.each([[0, '0.00 USD'], [1.2, '1.20 USD'], [12.346, '12.35 USD'],
  [null, '— USD'], [NaN, '— USD'], [-1, '— USD']] as const)('formats USD %s as %s', (value, expected) => {
  expect(formatUsageUsd(value)).toBe(expected);
});
