import { createServerSshProfiles, sshProfileHttpExchange, type SshProfileRequest }
  from '../../../shared/terminal/serverSshProfiles';
import { sshProfileResponse } from '../../../shared/terminal/sshProfileResponse';
import { createDesktopSshProfiles } from '../src/api/sshProfiles';
import { createWebSshProfiles } from '../../web/src/sshProfiles';
import { setActiveSession } from '../../web/src/api';

export const sshFixtureIdentity = { baseUrl: 'http://127.0.0.1:1499', userId: '00000000-0000-4000-8000-000000000101' };
const session = { baseUrl: sshFixtureIdentity.baseUrl, accessToken: 'ssh-fixture', refreshToken: 'fixture-only',
  email: 'ssh-fixture@example.test' };
export const sshFixtureExchange = sshProfileHttpExchange(async (path, init) => sshProfileResponse(await fetch(
  `${session.baseUrl}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${session.accessToken}` } },
)));

export function cloudFixtureCommand(command: string, body: unknown): Promise<unknown> | undefined {
  if (command === 'get_cloud_auth_state') return Promise.resolve({ ...sshFixtureIdentity, authenticated: true });
  if (command === 'cloud_ssh_profiles') {
    return sshFixtureExchange((body as { request: SshProfileRequest }).request);
  }
}

export function fixtureProfiles(mode: string) {
  if (mode === 'web') { setActiveSession(session); return createWebSshProfiles(session); }
  return createDesktopSshProfiles(sshFixtureIdentity);
}

export const fixtureDirectProfiles = createServerSshProfiles(sshFixtureExchange);
