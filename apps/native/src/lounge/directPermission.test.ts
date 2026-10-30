import { expect, it, vi } from 'vitest';
import { checkDirectPermission } from '../../../../shared/lounge/directPermission';
import { historyPosition, type HistoryPage } from '../../../../shared/lounge/archive';
import type { LoungeMessage } from '../../../../shared/lounge/types';

const self = { id: 'self', account: 'self@test' };
const peer = { id: 'peer', account: 'peer@test' };
const sent: LoungeMessage = { type: 'message', id: 'one', text: 'hello', images: [], sender: self,
  recipient: peer, conversation: peer.id, sentAt: '2026-10-28T00:00:00Z' };

it('restores the opening limit from native local history without a DOM or a server content request', async () => {
  expect(typeof document).toBe('undefined');
  const page = vi.fn(async (): Promise<HistoryPage> => ({ messages: [sent] }));
  await expect(checkDirectPermission({ self: self.id, peer: peer.id, page })).rejects.toThrow('awaitingReply');
  expect(page).toHaveBeenCalledWith({ query: '', conversation: peer.id, before: undefined });
  await checkDirectPermission({ self: self.id, peer: peer.id, page, permission: 'open' });
  expect(page).toHaveBeenCalledOnce();
});

it('finds an older reply beyond the current history page and keeps other conversations restricted', async () => {
  const page = vi.fn<() => Promise<HistoryPage>>()
    .mockResolvedValueOnce({ messages: [sent], next: historyPosition(sent) })
    .mockResolvedValueOnce({ messages: [{ ...sent, id: 'reply', sender: peer, recipient: self }] });
  await checkDirectPermission({ self: self.id, peer: peer.id, page });
  expect(page).toHaveBeenCalledTimes(2);
  await expect(checkDirectPermission({ self: self.id, peer: peer.id, page, permission: 'waiting' }))
    .rejects.toThrow('awaitingReply');
});
