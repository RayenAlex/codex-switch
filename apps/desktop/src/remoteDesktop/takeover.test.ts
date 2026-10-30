import { expect, it, vi } from 'vitest';
import { RemoteDesktopHostRegistry } from './hostRegistry';
import { DEFAULT_SETTINGS, desktopClient, type DesktopSettings } from '../../../../shared/remote-desktop/protocol';
import { occupiedDesktopGroup } from '../../../../shared/remote-desktop/takeover';

function createSession(settings: DesktopSettings) {
  const session = {
    closed: false,
    open: vi.fn(async () => ({ sdp: 'offer', iceServers: [], displayId: settings.displayId ?? 'first',
      capabilities: { displaySessions: true } })),
    close: vi.fn(async () => { session.closed = true; }),
    signal: vi.fn(async () => ({ candidates: [] })), update: vi.fn(async () => {}),
  };
  return session;
}

function fixture() {
  const sessions: ReturnType<typeof createSession>[] = [];
  const host = new RemoteDesktopHostRegistry(settings => {
    const session = createSession(settings); sessions.push(session); return session;
  });
  const client = (owner: string) => {
    host.register(owner, []);
    // Match the encrypted RPC boundary, which preserves Error.message rather than custom Error fields.
    return desktopClient(async <T>(body: object) => await host.request(body, owner) as T);
  };
  return { host, sessions, alice: client('alice'), bob: client('bob'), carol: client('carol') };
}

async function occupied(task: Promise<unknown>) {
  const error = await task.then(() => undefined, (value: unknown) => value);
  expect(error).toBeInstanceOf(Error);
  const group = occupiedDesktopGroup((error as Error).message);
  expect(group).toBeTruthy();
  return group!;
}

it('leaves the current connection untouched until confirmation and then revokes its controls', async () => {
  const { host, sessions, alice, bob } = fixture();
  await alice.open('first', DEFAULT_SETTINGS);
  const group = await occupied(bob.open('second', DEFAULT_SETTINGS));
  expect(sessions).toHaveLength(1); expect(sessions[0].closed).toBe(false);
  await alice.signal('first', { candidates: [] });
  await bob.open('second', DEFAULT_SETTINGS, group);
  expect(sessions[0].closed).toBe(true); expect(sessions[1].closed).toBe(false);
  expect(sessions[0].close.mock.invocationCallOrder[0]).toBeLessThan(sessions[1].open.mock.invocationCallOrder[0]);
  await expect(alice.signal('first', { candidates: [] })).rejects.toThrow('已结束');
  await alice.close('first');
  expect(sessions[1].closed).toBe(false);
  host.release();
});

it('closes every retained display on takeover, while normal display switching keeps its group', async () => {
  const { host, sessions, alice, bob } = fixture();
  await alice.open('first', DEFAULT_SETTINGS);
  await alice.open('extra', { ...DEFAULT_SETTINGS, retainedSession: 'first', displayId: 'second' });
  expect(sessions.every(session => !session.closed)).toBe(true);
  const group = await occupied(bob.open('replacement', DEFAULT_SETTINGS));
  await bob.open('replacement', DEFAULT_SETTINGS, group);
  expect(sessions.map(session => session.closed)).toEqual([true, true, false]);
  host.release();
});

it('rejects stale and simultaneous confirmations without disconnecting the newly reserved connection', async () => {
  const { host, sessions, alice, bob, carol } = fixture();
  await alice.open('first', DEFAULT_SETTINGS);
  const group = await occupied(bob.open('second', DEFAULT_SETTINGS));
  let finish!: () => void;
  sessions[0].close.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const opening = bob.open('second', DEFAULT_SETTINGS, group);
  const nextGroup = await occupied(carol.open('third', DEFAULT_SETTINGS, group));
  expect(nextGroup).not.toBe(group); expect(sessions).toHaveLength(1);
  finish(); await opening;
  await occupied(carol.open('third', DEFAULT_SETTINGS, group));
  expect(sessions[1].closed).toBe(false);
  await bob.close('second');
  await carol.open('third', DEFAULT_SETTINGS, nextGroup);
  expect(sessions[2].closed).toBe(false);
  host.release();
});

it('validates authorization and settings before disconnecting an existing viewer', async () => {
  const { host, sessions, alice, bob } = fixture();
  await alice.open('first', DEFAULT_SETTINGS);
  const takeover = await occupied(bob.open('second', DEFAULT_SETTINGS));
  const request = { action: 'open', id: 'second', settings: DEFAULT_SETTINGS, takeover, takeoverSupported: true };
  await expect(host.request(request, 'unknown')).rejects.toThrow('连接电脑');
  await expect(host.request({ ...request, settings: { quality: 'bad' } }, 'bob')).rejects.toThrow('有效的画质');
  host.register('bob', [], Date.now() - 1);
  await expect(host.request(request, 'bob')).rejects.toThrow('已结束');
  expect(sessions[0].closed).toBe(false); expect(sessions).toHaveLength(1);
  host.release();
});

it('waits for a superseded capture to finish cleaning up before opening its replacement', async () => {
  const { host, sessions, alice, bob, carol } = fixture();
  await alice.open('first', DEFAULT_SETTINGS);
  const group = await occupied(bob.open('second', DEFAULT_SETTINGS));
  let finish!: () => void;
  sessions[0].close.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const second = bob.open('second', DEFAULT_SETTINGS, group).catch(error => error);
  const nextGroup = await occupied(carol.open('third', DEFAULT_SETTINGS));
  const third = carol.open('third', DEFAULT_SETTINGS, nextGroup);
  await Promise.resolve(); expect(sessions).toHaveLength(1);
  finish(); expect(await second).toBeInstanceOf(Error); await third;
  expect(sessions).toHaveLength(2); expect(sessions[1].closed).toBe(false);
  host.release();
});
