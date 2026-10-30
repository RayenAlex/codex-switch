// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDeviceScreenControl } from '../../../../shared/remote-desktop/useDeviceScreenControl';

let root: Root;
let control: ReturnType<typeof useDeviceScreenControl>;
const request = vi.fn<(...args: [string, RequestInit]) => Promise<unknown>>();
const notify = vi.fn();
const device = { deviceId: 'chosen-pc', platform: 'Windows', online: true };
function Harness({ scope = 'account-a' }) {
  control = useDeviceScreenControl({ scope, request, notify });
  return null;
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks(); request.mockResolvedValue(undefined);
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('sends independent off/on device commands without a desktop connection', async () => {
  await control(device, true);
  expect(request).toHaveBeenCalledWith('/devices/chosen-pc/screen-power', expect.objectContaining({
    method: 'POST', body: '{"action":"off"}',
  }));
  expect(notify).toHaveBeenLastCalledWith('client.deviceScreen.offSent', false);
  await control(device, false);
  expect(request).toHaveBeenLastCalledWith('/devices/chosen-pc/screen-power', expect.objectContaining({
    body: '{"action":"on"}',
  }));
  expect(notify).toHaveBeenLastCalledWith('client.deviceScreen.onSent', false);
});

it('does not queue repeated commands or send commands to offline and unsupported devices', async () => {
  await control({ ...device, online: false }, true);
  await control({ ...device, platform: 'macOS' }, true);
  expect(request).not.toHaveBeenCalled();
  let finish!: () => void;
  request.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const first = control(device, true);
  await control(device, false);
  expect(request).toHaveBeenCalledTimes(1);
  finish(); await first;
  await control(device, false);
  expect(request).toHaveBeenCalledTimes(2);
});

it('cancels old account requests without showing success in the new account', async () => {
  let finish!: () => void;
  request.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const first = control(device, true);
  const signal = request.mock.calls[0][1].signal!;
  await act(async () => root.render(<Harness scope="account-b" />));
  expect(signal.aborted).toBe(true);
  notify.mockClear(); finish(); await first;
  expect(notify).not.toHaveBeenCalled();
  await control(device, false);
  expect(notify).toHaveBeenLastCalledWith('client.deviceScreen.onSent', false);
});

it('reports a timeout without automatically resending a power command', async () => {
  vi.useFakeTimers();
  request.mockImplementationOnce((_path, init) => new Promise((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const operation = control(device, true);
  await vi.advanceTimersByTimeAsync(35_000);
  await operation;
  expect(request).toHaveBeenCalledTimes(1);
  expect(notify).toHaveBeenLastCalledWith('client.deviceScreen.failed', true);
  await control(device, false);
  expect(request).toHaveBeenCalledTimes(2);
});

it('reports safe failures, permits retry, and ignores completion after leaving the page', async () => {
  request.mockRejectedValueOnce(new Error('client.deviceScreen.updateRequired'));
  await control(device, true);
  expect(notify).toHaveBeenLastCalledWith('client.deviceScreen.updateRequired', true);
  request.mockRejectedValueOnce(new Error('private diagnostic detail'));
  await control(device, true);
  expect(notify).toHaveBeenLastCalledWith('client.deviceScreen.failed', true);
  let finish!: () => void;
  request.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const last = control(device, true);
  await act(async () => root.render(null));
  notify.mockClear(); finish(); await last;
  expect(notify).not.toHaveBeenCalled();
});
