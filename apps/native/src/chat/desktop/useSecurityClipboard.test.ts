import { beforeEach, expect, it, vi } from 'vitest';
import * as Clipboard from 'expo-clipboard';
import { useSecurityClipboard } from './useSecurityClipboard';

const runtime = vi.hoisted(() => ({ cleanup: undefined as (() => void) | undefined, status: vi.fn(), busy: vi.fn() }));
vi.mock('react', () => ({ useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, typeof value === 'string' ? runtime.status : runtime.busy],
  useEffect: (effect: () => (() => void)) => { runtime.cleanup = effect(); },
}));
vi.mock('expo-clipboard', () => ({ getStringAsync: vi.fn(), setStringAsync: vi.fn() }));
const clipboard = { read: vi.fn(), write: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks();
  clipboard.read.mockResolvedValue({ format: 'text', text: 'remote text' });
  clipboard.write.mockResolvedValue(undefined);
  vi.mocked(Clipboard.getStringAsync).mockResolvedValue('local text');
  vi.mocked(Clipboard.setStringAsync).mockResolvedValue(true);
});

it('transfers text both ways only after a user action', async () => {
  const actions = useSecurityClipboard(clipboard, true);
  expect(clipboard.read).not.toHaveBeenCalled(); expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
  actions.copy();
  await vi.waitFor(() => expect(runtime.status).toHaveBeenCalledWith('已复制到本机。'));
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('remote text');
  actions.paste();
  await vi.waitFor(() => expect(clipboard.write).toHaveBeenCalledWith({ format: 'text', text: 'local text' }, true));
});

it('stops late reads after synchronization is disabled', async () => {
  let finish!: (value: { format: 'text'; text: string }) => void;
  clipboard.read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const actions = useSecurityClipboard(clipboard, true);
  actions.copy(); actions.copy(); expect(clipboard.read).toHaveBeenCalledOnce();
  runtime.cleanup!(); finish({ format: 'text', text: 'private' });
  await vi.waitFor(() => expect(runtime.busy).toHaveBeenLastCalledWith(false));
  expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
});

it('does not read either clipboard while inactive', () => {
  const actions = useSecurityClipboard(clipboard, false);
  actions.copy(); actions.paste();
  expect(clipboard.read).not.toHaveBeenCalled(); expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
});

it('reports clipboard permission denial without sending remote input', async () => {
  vi.mocked(Clipboard.getStringAsync).mockRejectedValue(new Error('permission denied'));
  useSecurityClipboard(clipboard, true).paste();
  await vi.waitFor(() => expect(runtime.busy).toHaveBeenLastCalledWith(false));
  expect(clipboard.write).not.toHaveBeenCalled();
  expect(runtime.status).toHaveBeenLastCalledWith('无法访问剪贴板，请重试。');
});
