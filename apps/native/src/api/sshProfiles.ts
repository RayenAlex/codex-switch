import { authorizedRequest } from './client';
import type { AuthSession } from '../types';
import { createServerSshProfiles, sshProfileHttpExchange }
  from '../../../../shared/terminal/serverSshProfiles';
import { sshProfileResponse } from '../../../../shared/terminal/sshProfileResponse';

export const createNativeSshProfiles = (session: AuthSession) => createServerSshProfiles(sshProfileHttpExchange(
  async (path, init) => sshProfileResponse(await authorizedRequest(session, path, init)),
));
