import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AutoUnlockSettings } from './AutoUnlockSettings';
import type { SecuritySettingsProps } from '../../../../../shared/remote-desktop/security';

const form = vi.hoisted(() => ({ editing: false, username: 'PC\\alice', password: 'fixture-password',
  toggle: vi.fn(), edit: vi.fn(), cancel: vi.fn(), save: vi.fn(), setUsername: vi.fn(), setPassword: vi.fn() }));
vi.mock('../../../../../shared/remote-desktop/useAutoUnlockForm', () => ({ useAutoUnlockForm: () => form }));
vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() }));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput',
  StyleSheet: { create: <T,>(value: T) => value } }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
interface Props { children?: ReactNode; accessibilityLabel?: string; disabled?: boolean; secureTextEntry?: boolean;
  autoComplete?: string; onPress?: () => void; onChangeText?: (value: string) => void }
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap(child => isValidElement<Props>(child)
    ? [child, ...nodes(child.props.children)] : []);
}
const props: SecuritySettingsProps = { connected: true, control: true, supported: true,
  value: { lockOnDisconnect: false, muteHost: false, autoUnlock: { enabled: true, status: 'ready' } },
  saving: false, error: '', update: vi.fn(async () => {}), close: vi.fn(),
  privacy: { available: true, enabled: false, toggle: vi.fn() },
  clipboard: { available: true, enabled: true, toggle: vi.fn() } };
beforeEach(() => { form.editing = false; vi.clearAllMocks(); vi.stubGlobal('React', React); });

it('supports enabling, editing and disabling through the shared credential flow', () => {
  const tree = nodes(AutoUnlockSettings(props));
  tree.find(node => node.props.accessibilityLabel === '自动解锁被控端')!.props.onPress!();
  tree.find(node => node.props.accessibilityLabel === '修改登录信息')!.props.onPress!();
  expect(form.toggle).toHaveBeenCalledOnce(); expect(form.edit).toHaveBeenCalledOnce();
});
it('masks passwords and disables autofill in the mobile form', () => {
  form.editing = true;
  const tree = nodes(AutoUnlockSettings(props));
  const password = tree.find(node => node.props.accessibilityLabel === 'Windows 登录密码')!;
  expect(password.props.secureTextEntry).toBe(true); expect(password.props.autoComplete).toBe('off');
  password.props.onChangeText!('changed'); expect(form.setPassword).toHaveBeenCalledWith('changed');
  tree.find(node => node.props.accessibilityLabel === '保存并启用')!.props.onPress!();
  expect(form.save).toHaveBeenCalledOnce();
});
it.each([{ control: false }, { connected: false }, { supported: false }, { saving: true }])(
  'disables automatic unlock when host settings cannot change: %j', restriction => {
    const tree = nodes(AutoUnlockSettings({ ...props, ...restriction }));
    expect(tree.find(node => node.props.accessibilityLabel === '自动解锁被控端')!.props.disabled).toBe(true);
  });
