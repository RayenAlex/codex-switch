import { beforeEach, expect, it, vi } from 'vitest';
import type { DownloadTask } from './types';
import { useManagedDownload } from './useManagedDownload';

const mocks = vi.hoisted(() => ({
  tasks: [] as DownloadTask[], share: vi.fn(), open: vi.fn(), enqueue: vi.fn(),
  values: [] as unknown[], cursor: 0, pending: { current: false },
}));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.values)) mocks.values[index] = initial;
    return [mocks.values[index], (value: unknown) => { mocks.values[index] = value; }];
  },
  useRef: () => mocks.pending,
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('../chat/fileDownloadTarget', () => ({ nativeDownloadTarget: vi.fn() }));
vi.mock('./manager', () => ({ downloadManager: {
  subscribe: vi.fn(), snapshot: () => mocks.tasks,
  connection: () => ({ owner: 'owner', deviceId: 'pc', ready: false }),
  share: mocks.share, open: mocks.open, enqueue: mocks.enqueue,
} }));

const options = { client: { open: vi.fn(), read: vi.fn(), close: vi.fn() },
  threadId: 'thread', path: 'F:/project/app.apk', ready: false };
function render() { mocks.cursor = 0; return useManagedDownload(options); }

beforeEach(() => {
  vi.clearAllMocks(); mocks.values = []; mocks.cursor = 0; mocks.pending.current = false;
  mocks.share.mockResolvedValue(undefined);
  mocks.tasks = [{ id: 'saved-file', name: 'app.apk', status: 'completed',
    source: { owner: 'owner', deviceId: 'pc', deviceName: 'PC', scope: 'project',
      threadId: options.threadId, path: options.path },
    uri: 'content://media/external/downloads/1', size: 10, received: 10, createdAt: 1,
    message: '已保存到下载文件夹' }];
});

it('shares the completed local download offline without opening or downloading it again', async () => {
  const download = render();
  expect(download.label).toBe('打开文件');
  expect(download.share).toBeTypeOf('function');
  await download.share?.();
  expect(mocks.share).toHaveBeenCalledExactlyOnceWith(mocks.tasks[0]);
  expect(mocks.open).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

it.each(['downloading', 'paused', 'failed'] as const)('does not share an unfinished %s task', status => {
  mocks.tasks[0].status = status;
  expect(render().share).toBeUndefined();
});

it('ignores missing local files and tasks from another computer', () => {
  mocks.tasks[0].uri = undefined;
  expect(render().share).toBeUndefined();
  mocks.tasks[0].uri = 'content://media/external/downloads/1';
  mocks.tasks[0].source.deviceId = 'other-pc';
  expect(render().share).toBeUndefined();
});

it('prevents repeated shares and shows failures ahead of the saved-file message', async () => {
  let rejectShare: (reason: Error) => void = () => {};
  mocks.share.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectShare = reject; }));
  const download = render();
  const first = download.share?.();
  await download.share?.();
  expect(mocks.share).toHaveBeenCalledOnce();
  expect(render().sharing).toBe(true);
  rejectShare(new Error('Private file path'));
  await first;
  const failed = render();
  expect(failed.sharing).toBe(false);
  expect(failed.message).toBe('无法分享，请确认文件仍在手机上后重试。');
  await failed.share?.();
  expect(mocks.share).toHaveBeenCalledTimes(2);
  expect(render().message).toBe('已保存到下载文件夹');
});
