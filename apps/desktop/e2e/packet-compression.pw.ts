import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { test, expect } from '@playwright/test';
import type {} from './packet-compression-harness';

test('native browser Worker interoperates with zlib and bounds invalid output without blocking UI timers', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/e2e/packet-compression-harness.html');
  const bytes = Buffer.from('中文😀 bounded independent chat fragment '.repeat(200));
  const result = await page.evaluate(({ input, encoded }) => window.packetCodecCheck(input, encoded), {
    input: [...bytes], encoded: [...deflateRawSync(bytes, { level: 1 })],
  });
  expect(Buffer.from(result.external).equals(bytes)).toBe(true);
  expect(inflateRawSync(Uint8Array.from(result.compressed)).equals(bytes)).toBe(true);
  expect(result.compressed.length).toBeLessThan(bytes.length / 2);
  expect(result.ticks).toBeGreaterThan(1);
  expect(result.bounded && result.truncated && result.trailing).toBe(true);
  expect(errors).toEqual([]);
});
