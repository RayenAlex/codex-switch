import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { Chunk } from '@codemirror/merge';
import { blameCommitAt, blameRecencyOpacity, originalBlameLine } from '../../../../shared/project-browser/blameGutter';
import type { ProjectBlame } from '../../../../shared/project-browser/protocol';

describe('blame mapping for drafts', () => {
  const baseline = 'first line\nsecond line\nthird line\nfourth line\n';
  const source = EditorState.create({ doc: baseline }).doc;
  function mapping(text: string) {
    const current = EditorState.create({ doc: text }).doc;
    const chunks = Chunk.build(source, current);
    return Array.from({ length: current.lines }, (_, index) =>
      originalBlameLine(source, chunks, current.line(index + 1).from));
  }
  it('marks edited lines and preserves shifted lines after insertions and deletions', () => {
    expect(mapping(baseline)).toEqual([1, 2, 3, 4, 5]);
    expect(mapping('first line\nchanged line\nthird line\nfourth line\n')).toEqual([1, null, 3, 4, 5]);
    expect(mapping('inserted\n' + baseline)).toEqual([null, 1, 2, 3, 4, 5]);
    expect(mapping('first line\nthird line\nfourth line\n')).toEqual([1, 3, 4, 5]);
    expect(mapping(baseline + 'new')).toEqual([1, 2, 3, 4, null]);
  });
  it('normalizes CRLF without attributing merged or split lines', () => {
    expect(mapping(baseline.replaceAll('\n', '\r\n'))).toEqual([1, 2, 3, 4, 5]);
    expect(mapping('first linesecond line\nthird line\nfourth line\n')).toEqual([null, 3, 4, 5]);
  });
  it('looks up compact ranges without assigning missing lines or uncommitted ranges', () => {
    const author = { hash: 'a'.repeat(40), author: 'Alice', time: 1, timezone: '+0000', summary: 'Initial' };
    const blame: ProjectBlame = { status: 'ready', revision: 'v1', commits: [author], ranges: [
      { start: 1, count: 3, commit: 0 }, { start: 4, count: 1, commit: null },
    ] };
    expect(blameCommitAt(blame, 2)).toBe(author);
    for (const line of [null, 0, 4, 5]) expect(blameCommitAt(blame, line)).toBeUndefined();
  });
});

describe('blame recency', () => {
  const now = Date.parse('2026-10-28T00:00:00Z') / 1000;
  const day = 86_400;
  it('fades with absolute age and stays visible for old commits', () => {
    const shades = [0, 1, 30, 120, 365, 3650].map(age => blameRecencyOpacity(now - age * day, now));
    for (let index = 1; index < shades.length; index += 1) expect(shades[index]).toBeLessThan(shades[index - 1]);
    expect(shades.at(-1)).toBeGreaterThan(0);
    expect(shades[0]).toBeLessThan(0.5);
  });
  it('clamps future timestamps and keeps invalid dates at the oldest shade', () => {
    expect(blameRecencyOpacity(now + day, now)).toBe(blameRecencyOpacity(now, now));
    expect(blameRecencyOpacity(Number.NaN, now)).toBe(0.08);
    expect(blameRecencyOpacity(Number.POSITIVE_INFINITY, now)).toBe(0.08);
  });
});
