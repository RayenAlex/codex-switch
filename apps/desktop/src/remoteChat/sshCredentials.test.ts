import { expect, it, vi } from 'vitest';
import { createServerSshProfiles, sshProfileHttpExchange } from '../../../../shared/terminal/serverSshProfiles';
import { parseSshCredentials, resolveSshLogin } from '../../../../shared/terminal/sshCredentials';
import { sshProfileResponse } from '../../../../shared/terminal/sshProfileResponse';

const profile = { id: 'saved', name: 'Server', host: 'server.test', port: 22, username: 'user',
  auth: 'key' as const, revision: 1, accountScope: 'account' };
const credentials = { privateKey: 'PRIVATE KEY fixture', passphrase: 'test-passphrase' };

it('keeps credentials out of profile metadata and reads them only through the authorized revision-bound endpoint', async () => {
  const json = vi.fn(async (_path: string, init: RequestInit): Promise<unknown> =>
    init.method === 'POST' ? { credentials } : [profile]);
  const store = createServerSshProfiles(sshProfileHttpExchange(json), async () => 'account');
  await store.save(profile, credentials);
  const body = JSON.parse(String(json.mock.calls[0][1].body));
  expect(body).toEqual({ ...profile, accountScope: undefined, credentials });
  const list = await store.list();
  expect(JSON.stringify(list)).not.toContain('PRIVATE KEY');
  expect(await store.credentials!(list[0])).toEqual(credentials);
  expect(json).toHaveBeenLastCalledWith('/sync/ssh-profiles/saved/credentials', expect.objectContaining({
    method: 'POST', body: '{"revision":1}',
  }));
});

it('discards credentials when the account changes during the request', async () => {
  let account = 'account';
  const store = createServerSshProfiles(async () => { account = 'other'; return { credentials }; }, async () => account);
  await expect(store.credentials!(profile)).rejects.toThrow('client.ssh.signIn');
});

it('uses newly entered keys directly and can replace a saved key passphrase without exposing the key in the form',
  async () => {
    const read = vi.fn(async () => credentials);
    const store = { credentials: read, list: vi.fn(), save: vi.fn(), remove: vi.fn() };
    const replaced = { ...profile, privateKey: 'replacement-key', passphrase: 'replacement-phrase' };
    expect(await resolveSshLogin({ values: replaced, selected: profile, store })).toEqual(replaced);
    expect(read).not.toHaveBeenCalled();
    const values = { ...profile, passphrase: 'new-passphrase' };
    expect(await resolveSshLogin({ values, selected: profile, store }))
      .toEqual({ ...values, privateKey: credentials.privateKey });
    expect(values).not.toHaveProperty('privateKey');
  });

it.each([{ host: 'other.test' }, { username: 'other' }, { port: 2222 }, { auth: 'password' as const }])
('never reuses saved secrets after changing the login target %j', async change => {
  const read = vi.fn(async () => credentials);
  const store = { credentials: read, list: vi.fn(), save: vi.fn(), remove: vi.fn() };
  try { await resolveSshLogin({ values: { ...profile, ...change }, selected: profile, store }); }
  catch (error) { expect((error as Error).message).toBe('client.ssh.credentialsRequired'); }
  expect(read).not.toHaveBeenCalled();
});

it('rejects oversized, malformed and mixed credential responses', () => {
  for (const value of [{ password: 'x'.repeat(4097) }, { privateKey: 'x'.repeat(65537) },
    { password: 'bad\0value' }, { password: 'secret', privateKey: 'key' }, { passphrase: 'no-key' },
    { ownerId: 'other' }, { toString: 'secret' }, []]) {
    expect(() => parseSshCredentials(value)).toThrow();
  }
  expect(parseSshCredentials(null)).toBeUndefined();
  expect(parseSshCredentials({ password: '' })).toEqual({ password: '' });
});

it('never displays credential response fragments when JSON decoding fails', async () => {
  await expect(sshProfileResponse(new Response('{"credentials":"private-key-fragment')))
    .rejects.toThrow('client.ssh.syncFailed');
});
