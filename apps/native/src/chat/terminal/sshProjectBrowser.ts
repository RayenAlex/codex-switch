import { setStringAsync } from 'expo-clipboard';
import type { SshApi } from '../../../../../shared/terminal/ssh';
import type { BrowserHost } from '../../../../../shared/project-browser/entryActions';
import { getSshProjectClient } from '../../../../../shared/terminal/sshProjectClient';
import { nativeSshDownload } from './sshTransfers';

export function nativeSshProjectBrowser(api: SshApi, id: string) {
  const { client, download } = getSshProjectClient(api, id, nativeSshDownload);
  const host: BrowserHost = {
    copyPath: async path => { await setStringAsync(path); }, download, downloadDirectory: false,
    entryActions: ['createFile', 'createFolder', 'rename', 'move', 'delete'],
  };
  return { client, host };
}
