import { describe, expect, it } from 'vitest';
import { isJsonPath, jsonHighlightLimit, MEBIBYTE, previewByteLength }
  from '../../../../../../shared/file-preview/jsonHighlightLimit';

describe('JSON preview size limits', () => {
  it.each([undefined, null, NaN, Infinity, 0, -1, 1.5, 101, '20'])(
    'uses 10 MB for an invalid saved limit: %s', value => expect(jsonHighlightLimit(value)).toBe(10),
  );
  it.each([1, 10, 20, 100])('accepts a custom limit of %s MB', value => {
    expect(jsonHighlightLimit(value)).toBe(value);
  });
  it('counts UTF-8 bytes and honors original encoding sizes from the host', () => {
    expect(previewByteLength('中文😀')).toBe(10);
    expect(previewByteLength('中文😀', 8)).toBe(8);
    expect(previewByteLength('中文😀', -1)).toBe(10);
    expect(previewByteLength('中文😀', NaN)).toBe(10);
    expect(previewByteLength('a'.repeat(10 * MEBIBYTE))).toBe(10 * MEBIBYTE);
  });
  it('recognizes JSON filenames without treating other code or prose as JSON', () => {
    for (const path of ['a.JSON', 'data.geojson', 'notebook.ipynb', 'config.jsonc', 'config.json5']) {
      expect(isJsonPath(path)).toBe(true);
    }
    for (const path of ['json.txt', 'config.json.ts', 'json', 'data.csv']) expect(isJsonPath(path)).toBe(false);
  });
});
