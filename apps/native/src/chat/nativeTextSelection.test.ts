import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setInterfaceLanguage } from "../../../../shared/localization/interfaceLanguage";
import { translateMessage } from "../../../../shared/localization/messages";

const bridge = vi.hoisted(() => ({ configure: vi.fn(), detach: vi.fn(), dismiss: vi.fn(),
  setLabels: vi.fn() }));
vi.mock('react-native', () => ({ NativeModules: { ChatTextSelection: bridge } }));
beforeEach(() => { vi.clearAllMocks(); setInterfaceLanguage('zh'); });
afterEach(() => setInterfaceLanguage('zh'));

const expected = (language: 'zh' | 'en' | 'ru' | 'ja') => ({ copy: translateMessage(language, "client.projectBrowser.copied"),
  selectAll: translateMessage(language, "client.projectBrowser.selectAll"), quote: translateMessage(language, "client.chat.quote") });

it('sends the selection toolbar titles in the interface language and after each change', async () => {
  const { syncSelectionLabels } = await import('./nativeTextSelection');
  const stop = syncSelectionLabels(bridge);
  expect(bridge.setLabels).toHaveBeenLastCalledWith({ copy: '复制', selectAll: '全选', quote: '引用' });
  for (const language of ['ru', 'ja', 'en'] as const) {
    setInterfaceLanguage(language);
    const labels = bridge.setLabels.mock.lastCall?.[0] as Record<string, string>;
    expect(labels).toEqual(expected(language));
    if (language === 'ja') expect(labels.copy).toBe('コピー');
    else expect(Object.values(labels).join('')).not.toMatch(/[㐀-鿿]/);
  }
  stop();
  bridge.setLabels.mockClear();
  setInterfaceLanguage('zh');
  // Only the module-level subscription remains after this caller unsubscribes.
  expect(bridge.setLabels).toHaveBeenCalledTimes(1);
});

it('keeps older native builds without the labels method working', async () => {
  const { syncSelectionLabels } = await import('./nativeTextSelection');
  const stop = syncSelectionLabels({ configure: vi.fn(), detach: vi.fn(), dismiss: vi.fn() });
  expect(() => { setInterfaceLanguage('ru'); stop(); }).not.toThrow();
  expect(syncSelectionLabels(undefined)).toBeTypeOf('function');
});
