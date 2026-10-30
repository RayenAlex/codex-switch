import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Pressable } from 'react-native';
import { DeviceOptionsMenu } from './DeviceOptionsMenu';
import type { RemoteDevice } from '../types';

const runtime = vi.hoisted(() => ({ confirming: false }));
vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'),
  useState: () => [runtime.confirming, (value: boolean) => { runtime.confirming = value; }],
  useEffect: vi.fn(), useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Platform: { OS: 'android' },
  ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: <T,>(value: T) => value, absoluteFill: {} } }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('../components/BottomSheet', () => ({ BottomSheet: 'BottomSheet' }));
vi.mock('../components/SheetScrollView', () => ({ SheetScrollView: 'SheetScrollView', SHEET_READABLE_WIDTH: 440 }));

interface Props { children?: ReactNode; disabled?: boolean; onPress?: () => void }
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap(child => isValidElement<Props>(child)
    ? [child, ...nodes(child.props.children)] : []);
}
function button(tree: ReactNode, label: string) {
  return nodes(tree).find(node => node.type === Pressable
    && nodes(node.props.children).some(child => child.props.children === label));
}
const device: RemoteDevice = { deviceId: 'pc', name: '工作电脑', platform: 'Windows', online: true,
  capabilities: [], localProxyRunning: false, lastSeenAt: '2026-10-23T00:00:00Z' };
const props = { device, deletingDeviceId: null, switchingAuthDeviceId: null,
  onClose: vi.fn(), onDelete: vi.fn(), onRevokeService: vi.fn(), onSelectAuthAccount: vi.fn(), onScreenControl: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); runtime.confirming = false; vi.stubGlobal('React', React); });

it('confirms shutdown in a drawer with one action and closes without sending a command', () => {
  const menu = DeviceOptionsMenu(props);
  button(menu, '关闭电脑屏幕')!.props.onPress!();
  expect(runtime.confirming).toBe(true);
  expect(props.onScreenControl).not.toHaveBeenCalled();
  const confirmation = DeviceOptionsMenu(props);
  expect(confirmation!.props.maxWidth).toBe(440);
  expect(confirmation!.props.title).toBe('暂时关闭电脑屏幕？');
  expect(confirmation!.props.subtitle).toBe(device.name);
  expect(button(confirmation, '取消')).toBeUndefined();
  expect(confirmation!.props.actions).toHaveLength(1);
  confirmation!.props.onClose();
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.onScreenControl).not.toHaveBeenCalled();
});

it('confirms screen shutdown for the selected computer and disables confirmation when offline', () => {
  runtime.confirming = true;
  const confirmation = DeviceOptionsMenu(props);
  confirmation!.props.actions[0].onPress();
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.onScreenControl).toHaveBeenCalledExactlyOnceWith(device, true);
  const offline = DeviceOptionsMenu({ ...props, device: { ...device, online: false } });
  expect(offline!.props.actions[0].disabled).toBe(true);
});

it('restores screens without a shutdown confirmation', () => {
  button(DeviceOptionsMenu(props), '恢复电脑屏幕')!.props.onPress!();
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.onScreenControl).toHaveBeenCalledExactlyOnceWith(device, false);
});

it('disables both actions offline and hides them on unsupported platforms', () => {
  const offline = DeviceOptionsMenu({ ...props, device: { ...device, online: false } });
  expect(button(offline, '关闭电脑屏幕')!.props.disabled).toBe(true);
  expect(button(offline, '恢复电脑屏幕')!.props.disabled).toBe(true);
  for (const platform of ['macOS', 'linux']) {
    const menu = DeviceOptionsMenu({ ...props, device: { ...device, platform } });
    expect(button(menu, '关闭电脑屏幕')).toBeUndefined();
    expect(button(menu, '恢复电脑屏幕')).toBeUndefined();
  }
});
