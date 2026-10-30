import { expect, it, vi } from 'vitest';
import { verifySshHost } from '../../../../shared/terminal/verifySshHost';
import { changedSshHostTrust } from '../../../../shared/terminal/sshHostTrust';
import type { SshProfile } from '../../../../shared/terminal/sshProfiles';
import type { SshApi } from '../../../../shared/terminal/ssh';

const profile: SshProfile = { id: 'first', name: 'Saved', host: 'server', port: 22,
  username: 'user', auth: 'password', fingerprint: 'SHA256:old', revision: 1, accountScope: 'account' };
function fixture() {
  let profiles = [profile, { ...profile, id: 'second', username: 'root' }];
  const api: SshApi = { probe: vi.fn(async () => 'SHA256:new'), open: vi.fn(), files: vi.fn(),
    profiles: { list: vi.fn(async () => profiles), remove: vi.fn(),
      save: vi.fn(async value => {
        profiles = profiles.map(old => old.id === value.id ? { ...value, revision: (value.revision ?? 0) + 1 } : old);
        return profiles;
      }) } };
  const options = { api, values: profile, selected: profile, active: () => true,
    save: api.profiles.save, prompt: vi.fn(), select: vi.fn() };
  return { options, approved: changedSshHostTrust(profiles, 'SHA256:new') };
}

it('updates pins for the same server across usernames and returns the new selected revision', async () => {
  const { options, approved } = fixture();
  const result = await verifySshHost({ ...options, approved });
  expect(options.save).toHaveBeenCalledTimes(2);
  expect(result).toMatchObject({ fingerprint: 'SHA256:new', selected: { revision: 2, fingerprint: 'SHA256:new' } });
  expect(options.save).toHaveBeenCalledWith({ ...profile, fingerprint: 'SHA256:new' });
});

it('prompts again if the server key changes after the confirmation was displayed', async () => {
  const { options, approved } = fixture();
  vi.mocked(options.api.probe).mockResolvedValue('SHA256:another');
  expect(await verifySshHost({ ...options, approved })).toBeUndefined();
  expect(options.save).not.toHaveBeenCalled();
  expect(options.prompt).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: 'SHA256:another' }));
});

it('blocks confirmation if the selected cloud record was edited or the account changed', async () => {
  const { options, approved } = fixture();
  vi.mocked(options.api.profiles.list).mockResolvedValue([{ ...profile, accountScope: 'another-account' }]);
  await expect(verifySshHost({ ...options, approved })).rejects.toThrow('client.ssh.profileChanged');
  expect(options.save).not.toHaveBeenCalled();
});

it('does not save after leaving and does not connect when persistence fails', async () => {
  const { options, approved } = fixture();
  expect(await verifySshHost({ ...options, approved, active: () => false })).toBeUndefined();
  expect(options.save).not.toHaveBeenCalled();
  vi.mocked(options.save).mockRejectedValue(new Error('client.ssh.storageFailed'));
  await expect(verifySshHost({ ...options, approved })).rejects.toThrow('client.ssh.storageFailed');
});
