// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createWebSshProfiles } from '../../../web/src/sshProfiles';
import { getActiveSession, setActiveSession } from '../../../web/src/api';

const session = { baseUrl: 'https://fixture.test', email: 'test@example.test',
  accessToken: 'test-token', refreshToken: 'test-refresh' };
const profile = { id: 'one', name: 'Server', host: '::1', port: 22, username: 'user', auth: 'key' as const, revision: 1 };
afterEach(() => { setActiveSession(null); vi.unstubAllGlobals(); });

it('refreshes expired web credentials and retries the server request without contacting a PC', async () => {
  setActiveSession(session);
  const fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockResolvedValueOnce(new Response('{"accessToken":"renewed","refreshToken":"next"}'))
    .mockResolvedValueOnce(new Response(JSON.stringify([profile])));
  vi.stubGlobal('fetch', fetch);
  expect(await createWebSshProfiles(session).list()).toEqual([profile]);
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    'https://fixture.test/sync/ssh-profiles', 'https://fixture.test/auth/refresh',
    'https://fixture.test/sync/ssh-profiles',
  ]);
  expect((fetch.mock.calls[2][1].headers as Headers).get('Authorization')).toBe('Bearer renewed');
});

it('does not retry a mutation under another account after a login change', async () => {
  setActiveSession(session);
  const other = { ...session, email: 'other@example.test', accessToken: 'other', refreshToken: 'other-refresh' };
  const fetch = vi.fn().mockImplementationOnce(async () => {
    setActiveSession(other);
    return new Response('{}', { status: 401 });
  }).mockResolvedValueOnce(new Response('{"accessToken":"other-renewed","refreshToken":"other-next"}'));
  vi.stubGlobal('fetch', fetch);
  await expect(createWebSshProfiles(session).save(profile)).rejects.toThrow('client.ssh.signIn');
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/sync/ssh-profiles/one'))).toHaveLength(1);
  expect(getActiveSession()?.email).toBe(other.email);
});

it('discards a late list reply after signing out', async () => {
  setActiveSession(session);
  vi.stubGlobal('fetch', vi.fn(async () => {
    setActiveSession(null);
    return new Response(JSON.stringify([profile]));
  }));
  await expect(createWebSshProfiles(session).list()).rejects.toThrow('client.ssh.signIn');
});
