import { displayText } from '../i18n/index';
import { t } from '../i18n';
import type { DownloadTask } from './types';
import { archivePercent, archiveStatus } from '../../../../shared/remote-chat/archiveDownload';

const KIB = 1024;
const MIB = KIB * KIB;
const GIB = MIB * KIB;
export function formatBytes(bytes: number) {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(1)} GB`;
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(1)} MB`;
  return `${Math.round(bytes / KIB)} KB`;
}
export function downloadPercent(task: DownloadTask) {
  if (task.status === 'preparing' && task.preparation) return archivePercent(task.preparation) ?? 0;
  if (task.status === 'completed') return 100;
  if (task.status === 'saving') return task.size ? Math.floor((task.savedBytes ?? 0) / task.size * 100) : 0;
  return task.size ? Math.min(100, Math.floor(task.received / task.size * 100)) : 0;
}
export const downloadStatus: Record<DownloadTask['status'], string> = {
  get preparing() { return t("client.downloads.preparingAndCheckingTheFile"); }, get verifying() { return t("client.downloads.verifying"); },
  get saving() { return t("client.downloads.saving"); },
  get queued() { return t("client.downloads.queued"); }, get downloading() { return t("client.mobile.downloading"); }, get paused() { return t("client.downloads.paused"); }, get completed() { return t("client.chat.completed"); }, get failed() { return t("client.mobile.downloadInterrupted"); },
};
export function downloadStatusLabel(task: DownloadTask) {
  return task.status === 'preparing' && task.preparation
    ? displayText(archiveStatus(task.preparation)) : downloadStatus[task.status];
}
export function downloadDetail(task: DownloadTask) {
  if (task.status === 'preparing') {
    if (!task.preparation || task.preparation.phase !== 'compressing') return downloadStatusLabel(task);
    return t("client.downloads.compressedFiles", {
      done: task.preparation.completedFiles, total: task.preparation.totalFiles,
    });
  }
  if (task.status === 'saving') return `${formatBytes(task.savedBytes ?? 0)} / ${formatBytes(task.size)}`;
  const speed = task.status === 'downloading' && task.bytesPerSecond
    ? ` · ${formatBytes(task.bytesPerSecond)}/s` : '';
  return `${formatBytes(task.received)} / ${formatBytes(task.size)}${speed}`;
}
