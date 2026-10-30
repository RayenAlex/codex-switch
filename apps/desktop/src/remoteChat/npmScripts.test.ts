import { describe, expect, it } from 'vitest';
import { isPackageJson, npmScriptEntries } from '../../../../shared/project-browser/npmScripts';

describe('package script buttons', () => {
  it('only locates string-valued scripts in the top-level scripts object', () => {
    const text = JSON.stringify({ nested: { scripts: { hidden: 'no' } }, scripts: {
      dev: 'vite', 'build:app': 'build', disabled: false, object: { command: 'no' }, empty: '',
    } }, null, 2);
    const entries = npmScriptEntries(text);
    expect(entries.map(entry => entry.name)).toEqual(['dev', 'build:app', 'empty']);
    for (const entry of entries) expect(text.slice(entry.from).startsWith(JSON.stringify(entry.name))).toBe(true);
  });
  it('handles escaped names, compact JSON and duplicate properties like npm', () => {
    const text = '{"scripts":{"old":"old"},"scri\\u0070ts":{"d\\u0065v":"vite","dev":false,"a:b":"ok"}}';
    expect(npmScriptEntries(text).map(entry => entry.name)).toEqual(['a:b']);
    expect(npmScriptEntries('{"scripts":{"a\\"b":"ok","two":"ok"}}').map(entry => entry.name))
      .toEqual(['a"b', 'two']);
  });
  it.each(['{', '{"scripts":{"dev":"vite",}}', '{"scripts":"text"}', '{"scripts":{"dev":"vite"},"scripts":null}',
    'null', '[]', '{"scripts":{"bad\\nname":"no"}}'])('does not offer commands for %s', text => {
    expect(npmScriptEntries(text)).toEqual([]);
  });
  it('matches package.json in nested projects on either platform', () => {
    expect(isPackageJson('C:\\repo\\web\\package.json')).toBe(true);
    expect(isPackageJson('/repo/web/package.json')).toBe(true);
    expect(isPackageJson('/repo/package-lock.json')).toBe(false);
  });
});
