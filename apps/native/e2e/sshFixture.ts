import type { SshApi } from '../../../shared/terminal/ssh';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';
import type { SshCredentials } from '../../../shared/terminal/sshCredentials';
import type { TerminalInfo } from '../../../shared/terminal/types';
import { createNativeSshProfiles } from '../src/api/sshProfiles';
import { createSshFileFixture } from './sshFileFixture';

const cloud = process.env.EXPO_PUBLIC_SSH_CLOUD_FIXTURE === '1' ? createNativeSshProfiles({
  baseUrl: 'http://127.0.0.1:1499', accessToken: 'ssh-fixture', refreshToken: 'fixture-only',
  email: 'ssh-fixture@example.test',
}) : undefined;

/** Disposable stores simulate independently synchronized metadata and credential requests. */
const stores = new Map<string, SshProfile[]>();
const secrets = new Map<string, SshCredentials>();
export function createSshFixture(computer: string, adopt: (info: TerminalInfo) => void): SshApi {
  if (!stores.has(computer)) {
    stores.set(computer, [{ id: 'saved', name: `Saved on ${computer}`,
      host: 'fixture.test', port: 22, username: 'fixture', auth: 'password', fingerprint: 'SHA256:fixture', revision: 1 },
    { id: 'password', name: 'Password server', host: 'password.test', port: 22, username: 'fixture',
      auth: 'password', fingerprint: 'SHA256:fixture', revision: 1 },
    { id: 'key', name: 'Key server', host: 'key.test', port: 22, username: 'fixture',
      auth: 'key', fingerprint: 'SHA256:fixture', revision: 1 }]);
    secrets.set(`${computer}:saved`, { password: 'fixture-password' });
    secrets.set(`${computer}:key`, { privateKey: 'fixture-private-key', passphrase: 'fixture-passphrase' });
  }
  return {
    profiles: cloud ?? {
      list: async () => stores.get(computer) ?? [],
      credentials: async value => secrets.get(`${computer}:${value.id}`),
      save: async (value, credentials) => {
        if (credentials) secrets.set(`${computer}:${value.id}`, credentials);
        const next = [...(stores.get(computer) ?? []).filter(item => item.id !== value.id),
          { ...value, revision: (value.revision ?? 0) + 1 }];
        stores.set(computer, next); return next;
      },
      remove: async id => {
        secrets.delete(`${computer}:${id}`);
        const next = (stores.get(computer) ?? []).filter(item => item.id !== id);
        stores.set(computer, next); return next;
      },
    },
    probe: async () => 'SHA256:fixture',
    open: async (request, projectCwd) => {
      if (request.password === 'wrong') throw new Error('client.ssh.authenticationFailed');
      if (['password.test', 'fixture.test'].includes(request.endpoint.host)
        && request.password !== 'fixture-password') {
        throw new Error('client.ssh.authenticationFailed');
      }
      if (request.endpoint.host === 'key.test'
        && (request.privateKey !== 'fixture-private-key' || request.passphrase !== 'fixture-passphrase')) {
        throw new Error('client.ssh.authenticationFailed');
      }
      const info = { id: `ssh-${Date.now()}`, cwd: '', projectCwd, shell: 'SSH',
        ssh: { ...request.endpoint, username: request.username } };
      adopt(info); return info;
    },
    files: createSshFileFixture(),
  };
}
