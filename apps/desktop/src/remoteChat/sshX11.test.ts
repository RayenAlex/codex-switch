import { describe, expect, it, vi } from 'vitest';
import { parseSshProfile } from '../../../../shared/terminal/sshProfiles';
import { sshConnectFromValues, sshProfileFromValues } from '../../../../shared/terminal/sshConnectionValues';
import { createServerSshProfiles, sshProfileHttpExchange,
  type SshProfileJson } from '../../../../shared/terminal/serverSshProfiles';
import { validSshX11 } from '../../../../shared/terminal/sshX11';

const profile = { id: 'server', name: 'Server', host: 'server.test', port: 22, username: 'user',
  auth: 'password' as const, fingerprint: 'SHA256:known', revision: 1 };

describe('X11 settings', () => {
  it.each([{}, { display: '' }, { display: ':0' }, { display: 'unix:1.2' }, { display: 'localhost:10' },
    { display: '127.0.0.1:59535.65535' }, { display: '[::1]:0' }])('accepts local displays %j', value => {
    expect(validSshX11(value)).toBe(true);
    expect(parseSshProfile({ ...profile, x11: value })?.x11).toEqual(value.display ? value : {});
  });

  it.each([null, [], true, { host: 'localhost' }, { display: 0 }, { display: 'remote.test:0' },
    { display: '192.168.1.2:0' }, { display: ':59536' }, { display: ':0.65536' }, { display: ':0\n' },
    { display: '/tmp/x11:0' }, { display: ':0', cookie: 'secret' }])('rejects invalid displays %j', value => {
    expect(validSshX11(value)).toBe(false);
    expect(parseSshProfile({ ...profile, x11: value })).toBeNull();
  });

  it('carries enabled forwarding into both the saved profile and connection without credentials', () => {
    const values = { ...profile, password: 'secret', x11: { display: 'localhost:1' } };
    const saved = sshProfileFromValues({ values, id: profile.id, selected: profile });
    expect(saved).toMatchObject({ ...profile, x11: values.x11 });
    expect(saved).not.toHaveProperty('password');
    expect(sshConnectFromValues(values, profile.fingerprint)).toMatchObject({ x11: values.x11, password: 'secret' });
    const disabled = sshProfileFromValues({ values: profile, id: profile.id, selected: saved });
    expect(disabled).not.toHaveProperty('x11');
    expect(sshConnectFromValues(profile, profile.fingerprint)).not.toHaveProperty('x11');
  });

  it('round-trips forwarding through the account API used by local, remote and Web clients', async () => {
    const value = { ...profile, x11: { display: ':0.1' } };
    const json = vi.fn<SshProfileJson>().mockResolvedValue([value]);
    const store = createServerSshProfiles(sshProfileHttpExchange(json));
    expect(await store.save(value)).toEqual([value]);
    expect(JSON.parse(String(json.mock.calls[0][1].body))).toEqual(value);
    expect(await store.list()).toEqual([value]);
  });
});
