import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatController } from '../../../../shared/remote-chat/client/controller';
import { projectThreadGroups, type SidebarSnapshot } from '../../../../shared/remote-chat/sidebar';
import type { ChatState } from '../../../../shared/remote-chat/client/types';
import type { ConnectionEvents } from '../../../../shared/remote-chat/client/connection';

const thread = { id: 'chat', cwd: '/project', preview: '', updatedAt: 1 };
const request = vi.fn();
let controller: ChatController;
let events: ConnectionEvents;
beforeEach(() => {
  request.mockReset();
  controller = new ChatController(callbacks => {
    events = callbacks;
    return { start() {}, stop() {}, request };
  });
  Object.assign(controller.snapshot(), { ready: true, selected: thread, draftProject: { cwd: '/project', label: 'project' },
    threads: [{ ...thread, id: 'other', cwd: '/other' }, thread] });
});
afterEach(() => controller.stop());

it('applies shared project ordering and moves removed conversations to Recent without losing selection', async () => {
  const sidebar: SidebarSnapshot = { revision: 1, threads: {}, readState: {}, pinnedProjects: ['/project'] };
  request.mockResolvedValueOnce(sidebar);
  await controller.projectActions.run('/project', 'pin');
  expect(request).toHaveBeenCalledExactlyOnceWith('request', {
    operation: 'guiProjectPin', cwd: '/project', pinned: true,
  });
  expect(projectThreadGroups(controller.snapshot().threads, controller.snapshot().sidebar).map(group => group.cwd))
    .toEqual(['/project', '/other']);
  request.mockResolvedValueOnce({ ...sidebar, revision: 2, pinnedProjects: [],
    threads: { chat: { cwd: '', projectName: '', title: 'Chat', running: false } } });
  await controller.projectActions.run('/project', 'remove');
  expect(controller.snapshot()).toMatchObject({ selected: { id: 'chat', cwd: '' }, draftProject: null,
    projectActionBusy: undefined });
  expect(projectThreadGroups(controller.snapshot().threads, controller.snapshot().sidebar).map(group => group.cwd))
    .toEqual(['/other', '']);
});

it('serializes project changes, preserves state on failure and permits retry', async () => {
  let fail!: (error: Error) => void;
  request.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const pending = controller.projectActions.run('/project', 'remove');
  await expect(controller.projectActions.run('/other', 'pin')).rejects.toThrow('waitForTheCurrentActionToFinish');
  fail(new Error('failed'));
  await expect(pending).rejects.toThrow('failed');
  expect(controller.snapshot()).toMatchObject({ selected: thread, projectActionBusy: undefined });
  request.mockResolvedValueOnce({ revision: 1, threads: {}, readState: {}, pinnedProjects: [] });
  await controller.projectActions.run('/project', 'unpin');
  expect(request).toHaveBeenLastCalledWith('request', { operation: 'guiProjectPin', cwd: '/project', pinned: false });
});

it.each<Partial<ChatState>>([{ ready: false }, { sending: true }, { workspaceBusy: true }, { threadActionBusy: 'chat' }])(
  'rejects unavailable changes before sending: %j', async patch => {
    Object.assign(controller.snapshot(), patch);
    await expect(controller.projectActions.run('/project', 'remove')).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

it('ignores responses from a disconnected session', async () => {
  let finish!: (sidebar: SidebarSnapshot) => void;
  request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = controller.projectActions.run('/project', 'pin');
  events.mode('offline');
  finish({ revision: 1, threads: {}, readState: {}, pinnedProjects: ['/project'] });
  await expect(pending).rejects.toThrow('client.errors.connectToYourComputerFirst');
  expect(controller.snapshot().sidebar.pinnedProjects).toBeUndefined();
  expect(controller.snapshot().projectActionBusy).toBeUndefined();
});
