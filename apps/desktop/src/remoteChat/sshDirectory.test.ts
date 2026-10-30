import { afterEach, expect, it, vi } from 'vitest';
import type { Terminal } from '@xterm/xterm';
import { bindSshDirectory, getSshDirectory, parseSshDirectory, reportSshDirectory, requestSshDirectory,
  subscribeSshDirectory } from '../../../../shared/terminal/sshDirectory';

const bindings: ReturnType<typeof bindSshDirectory>[] = [];
afterEach(() => { for (const binding of bindings.splice(0)) binding.dispose(); });

function fixture(id = 'ssh-directory') {
  const handlers = new Map<number, (data: string) => boolean | Promise<boolean>>();
  const writes: (() => void)[] = [];
  const terminal = {
    buffer: { active: { type: 'normal', baseY: 0, cursorY: 1, cursorX: 4 } },
    parser: { registerOscHandler: (code: number, callback: (data: string) => boolean | Promise<boolean>) => {
      handlers.set(code, callback); return { dispose: () => handlers.delete(code) };
    } },
    write: vi.fn((_data: Uint8Array, callback: () => void) => writes.push(callback)),
  } as unknown as Terminal;
  const write = vi.fn();
  const binding = bindSshDirectory({ id, terminal, write }); bindings.push(binding);
  const prompt = () => {
    binding.output([]); handlers.get(133)?.('B'); writes.shift()?.();
  };
  return { id, binding, write, handlers, writes, prompt, terminal };
}

it('decodes terminal paths without treating filename punctuation as URL query or fragment', () => {
  expect(parseSshDirectory('file://host/home/中文%20notes#1?x%25')).toBe('/home/中文 notes#1?x%');
  for (const value of ['https://host/tmp', 'file://host', 'file://host/a%ZZ', 'file://host/a%0ab']) {
    expect(parseSshDirectory(value)).toBeUndefined();
  }
});

it('shares actual cwd per session and notifies only when it changes', () => {
  const f = fixture(); const other = fixture('other'); const listener = vi.fn();
  const stop = subscribeSshDirectory(f.id, listener);
  f.handlers.get(7)?.('file://host/a%20b');
  expect(getSshDirectory(f.id)).toBe('/a b'); expect(getSshDirectory(other.id)).toBeUndefined();
  reportSshDirectory(f.id, '/a b'); reportSshDirectory(f.id, 'relative');
  expect(listener).toHaveBeenCalledOnce(); stop();
});

it('queues navigation until a clean prompt and quotes shell metacharacters literally', () => {
  const f = fixture();
  requestSshDirectory(f.id, "/home/it's $(touch bad)");
  expect(f.write).not.toHaveBeenCalled(); f.prompt();
  expect(f.write).toHaveBeenCalledExactlyOnceWith("cd -- '/home/it'\"'\"'s $(touch bad)'\r");
  f.binding.input(); requestSshDirectory(f.id, '/next');
  expect(f.write).toHaveBeenCalledOnce(); f.prompt();
  expect(f.write).toHaveBeenLastCalledWith("cd -- '/next'\r");
});

it('does not dispatch at a replayed prompt before a running-command marker', () => {
  const f = fixture(); requestSshDirectory(f.id, '/next');
  f.binding.output([]); f.handlers.get(133)?.('B'); f.handlers.get(133)?.('C'); f.writes.shift()?.();
  expect(f.write).not.toHaveBeenCalled(); f.prompt(); expect(f.write).toHaveBeenCalledOnce();
});

it('does not treat buffered prompt output as clean after the user has started typing', () => {
  const f = fixture(); requestSshDirectory(f.id, '/next');
  f.binding.output([]); f.binding.input(); f.handlers.get(133)?.('B'); f.writes.shift()?.();
  expect(f.write).not.toHaveBeenCalled(); f.prompt(); expect(f.write).toHaveBeenCalledOnce();
});

it('cancels pending navigation on disconnect and when browsing back to the actual cwd', () => {
  const f = fixture(); reportSshDirectory(f.id, '/home'); requestSshDirectory(f.id, '/other');
  requestSshDirectory(f.id, '/home'); f.prompt(); expect(f.write).not.toHaveBeenCalled();
  f.binding.input(); requestSshDirectory(f.id, '/other'); f.binding.disconnect(); f.prompt();
  expect(f.write).not.toHaveBeenCalled();
});

it('does not append navigation to a partial command restored in terminal history', () => {
  const f = fixture(); requestSshDirectory(f.id, '/next');
  f.binding.output([]); f.handlers.get(133)?.('B');
  Reflect.set(f.terminal.buffer.active, 'cursorX', 12);
  f.writes.shift()?.();
  expect(f.write).not.toHaveBeenCalled();
  f.prompt(); expect(f.write).toHaveBeenCalledOnce();
});

it('keeps replayed partial input dirty even when its cursor was moved back to the prompt column', () => {
  const f = fixture(); requestSshDirectory(f.id, '/next');
  f.binding.output([]); f.handlers.get(133)?.('B');
  f.handlers.get(633)?.('P;RemoteAiInput=1'); f.writes.shift()?.();
  expect(f.write).not.toHaveBeenCalled();
  f.prompt(); expect(f.write).toHaveBeenCalledOnce();
});
