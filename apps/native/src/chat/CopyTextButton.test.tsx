import React, { Children, isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CopyTextButton } from './CopyTextButton';
import { setInterfaceLanguage } from '../../../../shared/localization/interfaceLanguage';
import { translateMessage } from '../../../../shared/localization/messages';

const mocks = vi.hoisted(() => ({ copy: vi.fn(), announce: vi.fn(), fail: vi.fn(), success: vi.fn(),
  states: new Map<number, unknown>(), cursor: 0 }));
vi.mock('react', async original => ({ ...await original<typeof React>(),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!mocks.states.has(index)) mocks.states.set(index, initial);
    return [mocks.states.get(index), (value: unknown) => mocks.states.set(index, value)];
  },
  useRef: (current: unknown) => ({ current }), useEffect: () => {},
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('./copyText', () => ({ copyText: mocks.copy, saveTextFile: vi.fn() }));
vi.mock('../components/AppToast', () => ({ Toast: { fail: mocks.fail, success: mocks.success } }));
vi.mock('../components/BottomSheet', () => ({ BottomSheet: () => null }));
vi.mock('../theme/store', () => ({ useThemeColor: () => () => '#888' }));
vi.mock('../theme/styles', () => ({ createThemedStyles: () => () => ({}) }));
vi.mock('./styles', () => ({ useStyles: () => ({}), palette: {} }));
vi.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' }, AccessibilityInfo: { announceForAccessibility: mocks.announce },
  View: 'View', Text: 'Text', Pressable: 'Pressable',
}));

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.states.clear();
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers();
  setInterfaceLanguage('zh');
  vi.unstubAllGlobals();
});

interface NodeProps { children?: ReactNode; name?: string; onPress?: () => Promise<void> }
function nodes(tree: ReactNode): NodeProps[] {
  return Children.toArray(tree).flatMap(child => isValidElement<NodeProps>(child)
    ? [child.props, ...nodes(child.props.children)] : []);
}
function render() {
  mocks.cursor = 0;
  return nodes(CopyTextButton({ text: '用户内容' }));
}

it.each(['en', 'ru', 'ja'] as const)('keeps copy success and failure feedback correct in %s', async language => {
  setInterfaceLanguage(language);
  mocks.copy.mockResolvedValueOnce('copied').mockResolvedValueOnce('failed');
  await render().find(node => node.onPress)?.onPress?.();
  await Promise.resolve();
  expect(mocks.copy).toHaveBeenCalledWith('用户内容');
  expect(render().find(node => node.name)?.name).toBe('check');
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.announce).toHaveBeenLastCalledWith(translateMessage(language, 'client.chat.copied'));
  await render().find(node => node.onPress)?.onPress?.();
  await Promise.resolve();
  expect(mocks.fail).toHaveBeenCalledWith(translateMessage(language, 'client.app.couldNotCopyPleaseTryAgain'));
  expect(render().find(node => node.name)?.name).toBe('copy');
});
