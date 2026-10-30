import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SecuritySettings } from './SecuritySettings';
import type { SecuritySettingsProps } from '../../../../../shared/remote-desktop/security';

vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useState: (value: unknown) => [value, vi.fn()], useEffect: vi.fn(),
}));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', Text: 'Text', ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(value: T) => value } }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));

interface Props { children?: ReactNode; accessibilityRole?: string; accessibilityLabel?: string;
  accessibilityState?: { checked?: boolean; disabled?: boolean }; disabled?: boolean; onPress?: () => void }
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap(child => {
    if (!isValidElement<Props>(child)) return [];
    if (typeof child.type === 'function') return nodes((child.type as (props: Props) => ReactNode)(child.props));
    return [child, ...nodes(child.props.children)];
  });
}
const props: SecuritySettingsProps = { connected: true, control: true, supported: true,
  value: { lockOnDisconnect: false, muteHost: false }, saving: false, error: '', update: vi.fn(async () => {}),
  privacy: { available: true, enabled: false, toggle: vi.fn(async () => {}) },
  clipboard: { available: true, enabled: true, toggle: vi.fn() }, close: vi.fn() };
const clipboardActions = { busy: false, status: '', copy: vi.fn(), paste: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('React', React); });

it('shows all five options and sends only the selected security change', () => {
  const tree = nodes(SecuritySettings({ ...props, clipboardActions }));
  const button = (label: string) => tree.find(node => node.props.accessibilityLabel === label)!;
  expect(tree.filter(node => node.props.accessibilityRole === 'switch')).toHaveLength(4);
  expect(button('自动解锁被控端').props.disabled).toBe(true);
  button('远程结束后锁屏').props.onPress!();
  button('被控端静音运行').props.onPress!();
  expect(props.update).toHaveBeenNthCalledWith(1, { lockOnDisconnect: true });
  expect(props.update).toHaveBeenNthCalledWith(2, { muteHost: true });
  button('启用').props.onPress!(); expect(props.privacy.toggle).toHaveBeenCalledOnce();
  button('同步剪贴板').props.onPress!(); expect(props.clipboard.toggle).toHaveBeenCalledOnce();
  button('复制到本机').props.onPress!(); expect(clipboardActions.copy).toHaveBeenCalledOnce();
  button('粘贴到远程电脑').props.onPress!(); expect(clipboardActions.paste).toHaveBeenCalledOnce();
});

it.each([{ control: false }, { connected: false }, { supported: false }, { saving: true }])(
  'gates host changes while keeping the panel closable: %j', restriction => {
    const tree = nodes(SecuritySettings({ ...props, ...restriction, clipboardActions }));
    for (const label of ['远程结束后锁屏', '被控端静音运行']) {
      expect(tree.find(node => node.props.accessibilityLabel === label)!.props.disabled).toBe(true);
    }
    const close = tree.find(node => node.props.accessibilityLabel === '关闭安全选项')!;
    expect(close.props.disabled).not.toBe(true); close.props.onPress!(); expect(props.close).toHaveBeenCalledOnce();
  });

it('removes text transfer actions when clipboard synchronization is disabled', () => {
  const tree = nodes(SecuritySettings({ ...props, clipboard: { ...props.clipboard, enabled: false }, clipboardActions }));
  expect(tree.some(node => ['复制到本机', '粘贴到远程电脑'].includes(node.props.accessibilityLabel ?? ''))).toBe(false);
});
