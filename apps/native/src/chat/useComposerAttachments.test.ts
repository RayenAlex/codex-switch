import { displayText } from '../i18n/index';
import { Buffer } from 'buffer';
import type * as React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_CHAT_POLICY, MIB, setChatPolicy } from '../../../../shared/remote-chat/policy';
import { setInterfaceLanguage } from "../../../../shared/localization/interfaceLanguage";

import { useComposerAttachments } from './useComposerAttachments';

const state = vi.hoisted(() => ({ slots: [] as unknown[][], index: 0, pick: vi.fn(), read: vi.fn() }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof React>(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => undefined,
  useState: (initial: unknown) => {
    const slot = state.index++;
    state.slots[slot] ??= [];
    return [initial, (value: unknown) => { state.slots[slot].push(value); }];
  },
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: state.pick }));
vi.mock('expo-file-system', () => ({ readAsStringAsync: state.read, EncodingType: { Base64: 'base64' } }));

const GENERIC = "client.chat.couldNotAddTheFilePleaseChooseItAgain";
const SINGLE = "client.runtimeErrors.eachFileMustBeMbOrSmallerChooseASmaller";
const TOTAL = "client.runtimeErrors.filesSentAtOnceCannotExceedMbInTotalRemove";
const asset = (name: string, size: number) => ({ name, size, uri: `file:///cache/${name}` });
// The hook calls useState for items, busy and error, in that order.
const errors = () => state.slots[2] ?? [];

async function pickFiles(...assets: ReturnType<typeof asset>[]) {
  state.pick.mockResolvedValue({ canceled: false, assets });
  state.index = 0;
  await useComposerAttachments({ threadId: 'thread', sending: false }).pick();
  return errors().at(-1);
}

beforeEach(() => {
  state.slots = [];
  state.index = 0;
  state.pick.mockReset();
  state.read.mockReset();
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, fileUploadMaxMb: 2, fileUploadTotalMaxMb: 3 });
});

it('cancels without reading files or changing attachments and allows an immediate retry', async () => {
  const attachments = useComposerAttachments({ threadId: 'thread', sending: false });
  state.pick.mockResolvedValueOnce({ canceled: true, assets: null });
  await attachments.pick();
  expect(state.read).not.toHaveBeenCalled();
  expect(state.slots[0]).toEqual([]);
  expect(errors()).toEqual(['']);
  expect(state.slots[1]).toEqual([true, false]);
  state.pick.mockResolvedValueOnce({ canceled: false, assets: [asset('notes.txt', 5)] });
  state.read.mockResolvedValue('aGVsbG8=');
  await attachments.pick();
  expect(state.pick).toHaveBeenCalledTimes(2);
  expect(state.slots[0]).toHaveLength(1);
  expect(state.slots[1]).toEqual([true, false, true, false]);
});

it('ignores repeated presses while the system file picker is open', async () => {
  let cancel!: (value: { canceled: true; assets: null }) => void;
  state.pick.mockReturnValue(new Promise(resolve => { cancel = resolve; }));
  const attachments = useComposerAttachments({ threadId: 'thread', sending: false });
  const pending = attachments.pick();
  await attachments.pick();
  expect(state.pick).toHaveBeenCalledTimes(1);
  cancel({ canceled: true, assets: null });
  await pending;
  expect(state.slots[1]).toEqual([true, false]);
});
afterEach(() => { setInterfaceLanguage('zh'); setChatPolicy(DEFAULT_CHAT_POLICY); });

it.each(['en', 'ru'] as const)('shows the localized size limit for an over-size file in %s', async (language) => {
  setInterfaceLanguage(language);
  const message = await pickFiles(asset('large.zip', 2 * MIB + 1));
  expect(message).toBe(displayText(SINGLE, { value1: 2 }, language));
  expect(message).not.toBe(displayText(GENERIC, {}, language));
  expect(message).toContain('2');
  expect(state.read).not.toHaveBeenCalled();
});

it('shows the localized total limit when the files together are too large', async () => {
  setInterfaceLanguage('ru');
  state.read.mockResolvedValue(Buffer.alloc(2 * MIB).toString('base64'));
  const message = await pickFiles(asset('one.bin', 2 * MIB), asset('two.bin', 2 * MIB));
  expect(message).toBe(displayText(TOTAL, { value1: 3 }, 'ru'));
  expect(message).not.toBe(displayText(GENERIC, {}, 'ru'));
});

it('hides read failures behind the generic message regardless of wording', async () => {
  setInterfaceLanguage('en');
  state.read.mockRejectedValue(new Error('文件 could not be read'));
  expect(await pickFiles(asset('notes.txt', 10))).toBe(displayText(GENERIC, {}, 'en'));
});

it('keeps the Chinese limit message byte-identical', async () => {
  setInterfaceLanguage('zh');
  expect(await pickFiles(asset('large.zip', 2 * MIB + 1))).toBe('单个文件不能超过 2 MB，请选择较小的文件。');
  state.read.mockRejectedValue(new TypeError('boom'));
  expect(await pickFiles(asset('notes.txt', 10))).toBe(displayText(GENERIC, {}, 'zh'));
});
