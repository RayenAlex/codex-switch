import { t } from '../i18n';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { FileClient } from '../../../../shared/remote-chat/fileDownload';
import { useFileDownload } from '../../../../shared/remote-chat/useFileDownload';
import { downloadDetail } from './presentation';
import { nativeDownloadTarget } from '../chat/fileDownloadTarget';
import { downloadManager } from './manager';
import type { DownloadTask } from './types';

interface Options { client: FileClient; threadId: string | null; path: string; ready: boolean }

function useDownloadShare(task: DownloadTask | undefined) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const available = task?.status === 'completed' && !!task.uri;
  const share = async () => {
    if (!available || pending.current) return;
    pending.current = true; setSharing(true); setError('');
    try { await downloadManager.share(task); }
    catch { setError(t("client.downloads.couldNotShareTheFileCheckThatItIsStill")); }
    finally { pending.current = false; setSharing(false); }
  };
  return { sharing, share: available ? share : undefined, error };
}

function useAndroidDownload(options: Options) {
  const tasks = useSyncExternalStore(downloadManager.subscribe, downloadManager.snapshot);
  const [message, setMessage] = useState('');
  const [starting, setStarting] = useState(false);
  const connection = downloadManager.connection();
  const task = [...tasks].reverse().find(item => item.source.path === options.path
    && !item.source.preview && item.source.scope === 'project'
    && item.source.threadId === options.threadId && item.source.owner === connection?.owner
    && item.source.deviceId === connection?.deviceId);
  const { share, sharing, error: shareError } = useDownloadShare(task);
  const busy = starting || !!task && ['queued', 'preparing', 'downloading', 'verifying', 'saving'].includes(task.status);
  const percent = task?.size ? Math.floor(task.received / task.size * 100) : 0;
  const start = async () => {
    if (starting || (!options.ready && task?.status !== 'completed')
      || !connection || connection.files !== options.client) return;
    setStarting(true); setMessage('');
    try {
      if (task && task.status !== 'completed') await downloadManager.resume(task.id);
      else if (task) await downloadManager.open(task);
      else {
        await downloadManager.enqueue({ owner: connection.owner, deviceId: connection.deviceId,
          deviceName: connection.deviceName, scope: 'project', threadId: options.threadId ?? undefined,
          cwd: connection.cwd, path: options.path });
        setMessage(t("client.mobile.addedToDownloadsDownloadingContinuesAfterClosingThisWindow"));
      }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : t("client.mobile.cannotDownloadRightNowTryAgain")); }
    finally { setStarting(false); }
  };
  const pause = () => {
    if (task) void downloadManager.pause(task.id).catch(() => setMessage(t("client.mobile.couldNotPauseTryAgain")));
  };
  let label = t("client.projectBrowser.download");
  if (busy) label = t("client.mobile.pauseDownload", { value1: percent });
  else if (task?.status === 'completed') label = t("client.mobile.openFile");
  else if (task) label = t("client.downloads.resumeDownload");
  const detail = task ? downloadDetail(task) : '';
  return { busy, label, detail, completed: task?.status === 'completed', share, sharing,
    message: shareError || message || task?.message, start, cancel: pause };
}

// Each installed platform selects one stable hook implementation for its lifetime.
export const useManagedDownload = Platform.OS === 'android' ? useAndroidDownload : (options: Options) => ({
  ...useFileDownload({ ...options, target: nativeDownloadTarget, success: t("client.mobile.fileSavedToDownloads") }), completed: false,
  share: undefined, sharing: false,
});
