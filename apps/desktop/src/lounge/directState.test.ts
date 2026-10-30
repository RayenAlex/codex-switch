import { expect, it } from 'vitest';
import { LoungeDirectState } from '../../../../shared/lounge/directState';
import { checkDirectPermission } from '../../../../shared/lounge/directPermission';
import type { LoungeMessage } from '../../../../shared/lounge/types';

it('requires current permissions after reconnect and ignores stale updates after a reset', () => {
  const state = new LoungeDirectState(); state.resetAvailable = true;
  const sync = (generation: number, permission: string) => state.receive({
    generations: { bob: generation }, states: { bob: permission } });
  expect(state.ready('bob')).toBe(false);
  sync(0, 'open'); expect(state.ready('bob')).toBe(true);
  sync(1, 'new'); sync(0, 'open'); expect(state.permission('bob')).toBe('new');
  sync(1, 'waiting'); expect(state.permission('bob')).toBe('waiting');
  sync(1, 'open'); sync(1, 'waiting'); expect(state.permission('bob')).toBe('open');
  state.disconnect(); expect(state.ready('bob')).toBe(false);
  expect(state.accept({ generation: 0 } as LoungeMessage, 'bob')).toBe(false);
  expect(state.accept({ generation: 2 } as LoungeMessage, 'bob')).toBe(true);
  expect(state.permission('bob')).toBeUndefined(); expect(state.ready('bob')).toBe(true);
});

it('does not treat a previous conversation reply as permission for the new conversation', async () => {
  const old: LoungeMessage = { type: 'message', id: 'old', text: '', images: [], sentAt: new Date().toISOString(),
    sender: { id: 'bob', account: 'bob' }, recipient: { id: 'alice', account: 'alice' }, generation: 0 };
  const first: LoungeMessage = { ...old, id: 'first', sender: old.recipient!, recipient: old.sender, generation: 1 };
  const options = { self: 'alice', peer: 'bob', generation: 1, page: async () => ({ messages: [old] }) };
  await expect(checkDirectPermission(options)).resolves.toBeUndefined();
  await expect(checkDirectPermission({ ...options, page: async () => ({ messages: [old, first] }) }))
    .rejects.toThrow('awaitingReply');
});
