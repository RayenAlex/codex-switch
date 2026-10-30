import type { SshX11 } from '../../../../shared/terminal/ssh';
import type { SshCredentials } from '../../../../shared/terminal/sshCredentials';
import type { SshProfile, SshProfileStore } from '../../../../shared/terminal/sshProfiles';

export interface FixtureConfig {
  name: string; host: string; port: number; username: string; projectCwd: string;
  password?: string; privateKey?: string; passphrase?: string; x11?: SshX11;
}

/** Only profile persistence is replaced; all connection and file IPC stays native. */
export function memoryProfiles(config: FixtureConfig): SshProfileStore {
  let profiles: SshProfile[] = [{ id: 'wsl-native', name: config.name, host: config.host, port: config.port,
    username: config.username, auth: config.privateKey ? 'key' : 'password', revision: 1,
    x11: config.x11 ?? undefined }];
  const credentials = new Map<string, SshCredentials>([['wsl-native', {
    password: config.password ?? undefined, privateKey: config.privateKey ?? undefined,
    passphrase: config.passphrase ?? undefined,
  }]]);
  return {
    list: async () => profiles,
    credentials: async profile => credentials.get(profile.id),
    save: async (profile, secret) => {
      profiles = [...profiles.filter(value => value.id !== profile.id),
        { ...profile, revision: (profile.revision ?? 0) + 1 }];
      if (secret) credentials.set(profile.id, secret);
      return profiles;
    },
    remove: async id => { profiles = profiles.filter(value => value.id !== id); credentials.delete(id); return profiles; },
  };
}
