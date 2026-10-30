import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { createMergeModel, containsConflictMarkers } from '../../../../shared/git-merge/model';
import { mergeRanges, setMergeRanges } from '../../../../shared/git-merge/editorState';
import type { GitConflict } from '../../../../shared/remote-chat/gitTypes';

const conflict = (result: string): GitConflict => ({ path: 'file.ts', version: 'v1', base: 'base\n',
  ours: 'left\n', theirs: 'right\n', result, markerSize: 7 });

describe('merge document', () => {
  it('keeps non-conflicting edits and separates multiple diff3 blocks without leaking markers or ancestors', () => {
    const model = createMergeModel(conflict('prefix\r\n<<<<<<< HEAD\r\nleft\r\n||||||| base\r\nbase\r\n'
      + '=======\r\nright\r\n>>>>>>> incoming\r\ncommon\r\n<<<<<<< HEAD\r\nother-left\r\n'
      + '=======\r\nother-right\r\n>>>>>>> incoming\r\ntail'));
    expect(model.result.text).toBe('prefix\nleft\ncommon\nother-left\ntail');
    expect(model.left.text).toBe(model.result.text);
    expect(model.right.text).toBe('prefix\nright\ncommon\nother-right\ntail');
    expect(model.blocks).toEqual([{ id: 0, left: 'left\n', right: 'right\n' },
      { id: 1, left: 'other-left\n', right: 'other-right\n' }]);
    expect(model.lineEnding).toBe('\r\n');
    expect(model.result.ranges.map(range => model.result.text.slice(range.from, range.to)))
      .toEqual(['left\n', 'other-left\n']);
  });
  it('supports custom marker widths and empty sides', () => {
    const value = { ...conflict('<<<<<<<<< ours\n=========\nright\n>>>>>>>>> theirs\n'), markerSize: 9 };
    const model = createMergeModel(value);
    expect(model.blocks).toEqual([{ id: 0, left: '', right: 'right\n' }]);
    expect(model.result.ranges).toEqual([{ id: 0, from: 0, to: 0, resolved: false }]);
    expect(containsConflictMarkers(value.result!, 9)).toBe(true);
  });
  it('preserves external manual edits, missing final newlines and malformed conflict text', () => {
    for (const text of ['manual result', '<<<<<<< HEAD\nunfinished']) {
      const model = createMergeModel({ ...conflict(text), theirs: null });
      expect(model.result.text).toBe(text);
      expect(model.blocks).toHaveLength(1);
      expect(model.right.text).toBe('');
    }
    expect(containsConflictMarkers('const x = "<<<<<<<";\n======= value', 7)).toBe(true);
    expect(containsConflictMarkers('const x = "<<<<<<<";', 7)).toBe(false);
  });
  it('maps result blocks through edits before and within them', () => {
    let state = EditorState.create({ doc: 'common\nleft\ntail', extensions: [mergeRanges.init(() =>
      [{ id: 0, from: 7, to: 12, resolved: false }])] });
    state = state.update({ changes: { from: 0, insert: 'intro\n' } }).state;
    expect(state.field(mergeRanges)[0]).toEqual({ id: 0, from: 13, to: 18, resolved: false });
    state = state.update({ changes: { from: 14, to: 16, insert: 'edited' } }).state;
    expect(state.field(mergeRanges)[0].to).toBe(22);
    state = state.update({ effects: setMergeRanges.of([{ id: 0, from: 13, to: 22, resolved: true }]) }).state;
    expect(state.field(mergeRanges)[0].resolved).toBe(true);
  });
});
