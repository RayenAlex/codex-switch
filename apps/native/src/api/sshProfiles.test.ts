import { afterEach, expect, it, vi } from 'vitest';
import { createNativeSshProfiles } from './sshProfiles';
import { authorizedRequest } from './client';

vi.mock('./client', () => ({ authorizedRequest: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const session = { baseUrl: 'https://fixture.test', email: 'test@example.test',
  accessToken: 'test-token', refreshToken: 'test-refresh' };
const profile = { id: 'one', name: 'Server', host: '::1', port: 22, username: 'user', auth: 'key' as const, revision: 1 };

it('uses the phone account authorization directly for list, save and removal', async () => {
  vi.mocked(authorizedRequest).mockImplementation(async () => new Response(JSON.stringify([profile])));
  const store = createNativeSshProfiles(session);
  expect(await store.list()).toEqual([profile]);
  expect(authorizedRequest).toHaveBeenLastCalledWith(session, '/sync/ssh-profiles',
    expect.objectContaining({ method: 'GET' }));
  await store.save(profile);
  expect(authorizedRequest).toHaveBeenLastCalledWith(session, '/sync/ssh-profiles/one',
    expect.objectContaining({ method: 'PUT' }));
  await store.remove(profile.id, profile.revision);
  expect(authorizedRequest).toHaveBeenLastCalledWith(session, '/sync/ssh-profiles/one',
    expect.objectContaining({ method: 'DELETE', body: '{"revision":1}' }));
});

it('reports version conflicts and hides unexpected server details', async () => {
  const store = createNativeSshProfiles(session);
  vi.mocked(authorizedRequest).mockResolvedValue(new Response('{"message":"client.ssh.profileChanged"}', { status: 409 }));
  await expect(store.save(profile)).rejects.toThrow('client.ssh.profileChanged');
  vi.mocked(authorizedRequest).mockResolvedValue(new Response('{"message":"database internal path"}', { status: 500 }));
  await expect(store.list()).rejects.toThrow('client.ssh.syncFailed');
  vi.mocked(authorizedRequest).mockResolvedValue(new Response('{}', { status: 401 }));
  await expect(store.list()).rejects.toThrow('client.ssh.signIn');
});

it('loads login credentials from the phone account without putting them into the profile list', async () => {
  const credentials = { privateKey: 'PRIVATE KEY fixture', passphrase: 'test-passphrase' };
  vi.mocked(authorizedRequest).mockImplementation(async (_session, path) =>
    new Response(JSON.stringify(path.endsWith('/credentials') ? { credentials } : [profile])));
  const store = createNativeSshProfiles(session);
  await store.save(profile, credentials);
  expect(authorizedRequest).toHaveBeenLastCalledWith(session, '/sync/ssh-profiles/one',
    expect.objectContaining({ method: 'PUT' }));
  expect(JSON.parse(vi.mocked(authorizedRequest).mock.lastCall![2]!.body as string))
    .toEqual({ ...profile, credentials });
  expect(await store.credentials!(profile)).toEqual(credentials);
  expect(authorizedRequest).toHaveBeenLastCalledWith(session, '/sync/ssh-profiles/one/credentials',
    expect.objectContaining({ method: 'POST', body: '{"revision":1}' }));
  expect(await store.list()).toEqual([profile]);
});
