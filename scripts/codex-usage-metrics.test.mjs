import assert from "node:assert/strict";
import test from "node:test";
import { composerUsageMetrics } from "../shared/context-usage/metrics.js";

const snapshot = (overrides = {}) => ({ latestTokenUsageInfo: {
  total: { inputTokens: 10000, cachedInputTokens: 9000, outputTokens: 1000 },
  last: { inputTokens: 9000, cachedInputTokens: 9000, totalTokens: 1200 },
  modelContextWindow: 10000, ...overrides,
} });
const timing = { totalOutputTokens: 400, totalOutputTimeMs: 4000, outputRequestCount: 2 };

test("cache hit rate uses weighted conversation totals rather than the latest call or percentage means", () => {
  // A 1000-token uncached call followed by a 9000-token fully cached call is 90%, not 50% or 100%.
  const result = composerUsageMetrics(snapshot(), timing);
  assert.equal(result.cacheHit, 90);
  assert.equal(result.contextPercent, 12);
  assert.equal(result.speed, 100);
});

test("batched native output updates never change proxy-measured average speed", () => {
  const before = composerUsageMetrics(snapshot(), timing);
  const after = composerUsageMetrics(snapshot({ total: {
    inputTokens: 10000, cachedInputTokens: 9000, outputTokens: 100000,
  } }), timing);
  assert.equal(before.speed, 100);
  assert.equal(after.speed, 100);
  assert.equal(composerUsageMetrics(snapshot(), { ...timing, totalOutputTimeMs: 8000 }).speed, 50);
});

test("missing request timings stay unknown instead of falling back to a sampled estimate", () => {
  for (const invalid of [null, {}, { ...timing, outputRequestCount: 0 },
    { ...timing, totalOutputTimeMs: 0 }, { ...timing, totalOutputTimeMs: Infinity },
    { ...timing, totalOutputTokens: -1 }]) {
    assert.equal(composerUsageMetrics(snapshot(), invalid).speed, null);
  }
  assert.equal(composerUsageMetrics(snapshot(), { ...timing, totalOutputTokens: 0 }).speed, 0);
});

test("cumulative cache counts never fall back to the latest call when totals are unavailable", () => {
  assert.equal(composerUsageMetrics(snapshot({ total: {} }), timing).cacheHit, null);
  assert.equal(composerUsageMetrics(snapshot({ total: { inputTokens: 0, cachedInputTokens: 0 } }), timing).cacheHit, null);
  assert.equal(composerUsageMetrics(snapshot({ total: { inputTokens: 10, cachedInputTokens: 0 } }), timing).cacheHit, 0);
});

test("context estimates take precedence and independent available metrics remain visible", () => {
  assert.equal(composerUsageMetrics({}, null), null);
  assert.equal(composerUsageMetrics(snapshot({ contextTokens: 2000 }), timing).contextPercent, 20);
  const partial = composerUsageMetrics({}, timing);
  assert.equal(partial.speed, 100);
  assert.equal(partial.contextPercent, null);
  assert.equal(partial.cacheHit, null);
});
