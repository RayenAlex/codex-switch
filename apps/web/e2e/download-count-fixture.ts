import { getActiveSession } from '../src/api';
import { downloadManager, downloadOwner } from '../src/downloads/manager';
import type { DownloadClient } from '../../../shared/remote-chat/downloads';

let delay = 1000;
const client: DownloadClient = {
  open: async ({ path }) => ({ id: '11111111-1111-4111-8111-111111111111', name: path,
    size: 8 * 1024 * 1024, mimeType: 'application/octet-stream', revision: 'fixture' }),
  read: async ({ offset, length }) => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return { offset, data: btoa('A'.repeat(length)) };
  },
  close: async () => {},
  browse: async () => ({ directory: '', entries: [], truncated: false }),
};

export async function startDownloads(count: number) {
  const session = getActiveSession();
  if (!session) throw new Error('Sign into the local fixture first');
  const owner = downloadOwner(session);
  downloadManager.register({ owner, deviceId: 'fixture', deviceName: 'Fixture', ready: true, mode: 'direct', client,
    files: { open: async () => { throw new Error('Unused'); }, read: client.read, close: client.close } });
  for (let index = 0; index < count; index++) {
    await downloadManager.enqueue({ owner, deviceId: 'fixture', deviceName: 'Fixture',
      scope: 'computer', path: `file-${index}.bin` });
  }
}

export async function pauseDownloads() {
  for (const task of downloadManager.snapshot()) await downloadManager.pause(task.id);
}

export async function finishDownloads() {
  delay = 0;
  for (const task of downloadManager.snapshot()) await downloadManager.resume(task.id);
}
