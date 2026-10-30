import { expect, it, vi } from 'vitest';
import { handleNativeScriptAction, nativeScriptPanel, nativeScriptState }
  from '../../../../shared/project-browser/nativeScripts';

function fixture() {
  const panel = { busy: false, tabs: [
    { id: 'script', cwd: '/project', session: { id: 'script', cwd: '/project', shell: 'bash',
      npmScript: 'dev', npmScriptCwd: '/project/sub' } },
    { id: 'shell', cwd: '/project' },
    { id: 'outside', cwd: '/other', npmScript: 'dev' },
  ], addInDirectory: vi.fn(), remove: vi.fn() };
  return { panel, cwd: '/project', connected: true };
}

it('routes editor actions to the shared panel using script names and existing terminal identities', () => {
  const options = fixture();
  const state = nativeScriptState(options.panel);
  expect(state.tabs).toEqual([
    { id: 'script', cwd: '/project/sub', npmScript: 'dev', exited: false },
    { id: 'outside', cwd: '/other', npmScript: 'dev', exited: false },
  ]);
  const send = vi.fn(message => handleNativeScriptAction(message, options));
  const editor = nativeScriptPanel(state, send)!;
  editor.addInDirectory('/project/sub', 'dev:中文 & echo');
  expect(options.panel.addInDirectory).toHaveBeenCalledExactlyOnceWith('/project/sub', 'dev:中文 & echo');
  editor.remove('script');
  expect(options.panel.remove).toHaveBeenCalledExactlyOnceWith('script');
  expect(nativeScriptPanel(undefined, send)).toBeUndefined();
  expect(handleNativeScriptAction({ type: 'ready' }, options)).toBe(false);
});

it('rejects unsupported, disconnected, busy, malformed and out-of-project actions', () => {
  const options = fixture();
  const run = { type: 'npmScript', action: 'run', cwd: '/project', name: 'dev' };
  for (const change of [{ cwd: '/elsewhere' }, { cwd: '/project/../private' }, { cwd: '/project\0' },
    { name: '' }, { name: 'bad\ncommand' }, { name: 1 }, { name: 'x'.repeat(1025) }, { action: 'execute' }]) {
    expect(() => handleNativeScriptAction({ ...run, ...change }, options)).toThrow();
  }
  for (const id of ['shell', 'outside', 'unknown', 1]) {
    expect(() => handleNativeScriptAction({ type: 'npmScript', action: 'stop', id }, options)).toThrow();
  }
  for (const change of [{ panel: undefined }, { connected: false }, { panel: { ...options.panel, busy: true } }]) {
    expect(() => handleNativeScriptAction(run, { ...options, ...change })).toThrow();
  }
  expect(options.panel.addInDirectory).not.toHaveBeenCalled();
  expect(options.panel.remove).not.toHaveBeenCalled();
});
