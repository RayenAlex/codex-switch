import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setInterfaceLanguage } from "../../../../shared/localization/interfaceLanguage";
import { DownloadCard } from './DownloadCard';
import type { DownloadTask } from './types';

vi.mock('react', async original => ({ ...await original<typeof React>(),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() }));
vi.mock('react-native', () => ({ ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text',
  View: 'View', ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 } }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('../theme/store', () => ({ useThemeColor: () => (value: string) => value }));
vi.mock('./styles', () => ({ colors: { green: '#087f69', muted: '#7c8b86' },
  useStyles: () => new Proxy({}, { get: () => ({}) }) }));

type Element = ReactElement<{ children?: ReactNode }>;

function texts(node: ReactNode): string[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    const element = child as Element;
    const own = element.type === 'Text'
      ? [Children.toArray(element.props.children).filter(part => typeof part === 'string').join('')] : [];
    return [...own, ...texts(element.props.children)];
  });
}

const task: DownloadTask = { id: 'photo', name: 'photo.jpg', source: { owner: 'owner', deviceId: 'pc',
  deviceName: 'PC', scope: 'computer', path: 'C:/photo.jpg' }, status: 'completed', size: 2048, received: 2048,
  createdAt: 0, message: '已保存到相册' };
const render = (value: DownloadTask) => texts(DownloadCard({ task: value, connected: true, busy: false,
  action: () => {}, share: () => {}, remove: () => {} }));

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => { setInterfaceLanguage('zh'); vi.unstubAllGlobals(); });

it('replaces the completed save notice with localized completion details', () => {
  const completed = { ...task, createdAt: new Date(2026, 9, 25, 14, 0, 0).getTime(),
    completedAt: new Date(2026, 9, 25, 14, 1, 2).getTime() };
  expect(render(completed)).toContain('2026/10/25 14:01:02 · 用时1分2秒');
  expect(render(completed)).not.toContain('已保存到相册');
  setInterfaceLanguage('en');
  expect(render(completed).some(text => text.endsWith(' · 1 min 2 sec total'))).toBe(true);
  expect(render(completed)).not.toContain('Saved to photos');
  expect(render(task).some(text => /Not recorded|total/.test(text))).toBe(false);
});

it('keeps translated errors visible on unfinished downloads', () => {
  setInterfaceLanguage('ru');
  expect(render({ ...task, status: 'failed', message: '文件校验失败，请重试。' }))
    .toContain('Проверка файла не пройдена. Повторите попытку.');
  expect(render({ ...task, status: 'downloading', message: '' }).join(' ')).not.toContain('Общее время');
});

it('keeps messages without a dictionary entry verbatim', () => {
  setInterfaceLanguage('ru');
  expect(render({ ...task, status: 'failed', message: 'ENOSPC: no space left' })).toContain('ENOSPC: no space left');
});
