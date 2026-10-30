import React, { Children, isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatMessage } from './ChatMessage';
import type { Item } from './types';

vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  memo: <T,>(component: T) => component,
  useMemo: (callback: () => unknown) => callback(), useEffect: vi.fn(), useContext: () => null,
  useState: (initial: unknown) => [initial, vi.fn()],
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', View: 'View', Platform: { OS: 'android' },
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('./CopyTextButton', () => ({ CopyTextButton: 'Copy' }));
vi.mock('./ChatQuoteView', () => ({ QuoteChip: 'QuoteChip', QuoteDetails: 'QuoteDetails' }));
vi.mock('./Markdown', () => ({ ChatMarkdown: ({ text }: { text: string }) => text }));
vi.mock('../components/BottomSheet', () => ({ BottomSheet: 'Sheet' }));
vi.mock('../components/SheetScrollView', () => ({ SheetScrollView: 'Scroll' }));
vi.mock('./ChatFilePreview', async () => ({ ChatFileContext: (await import('react')).createContext(null) }));
vi.mock('./ChatImage', () => ({ ChatImage: 'Image' }));
vi.mock('./ChatActivityLabel', () => ({ ChatActivityLabel: 'Activity' }));
vi.mock('./ChatQuotes', async () => ({ QuoteSourceContext: (await import('react')).createContext(null),
  useChatQuotes: () => null }));

function content(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return String(child);
    if (typeof child.type === 'function') {
      return content((child.type as (props: unknown) => ReactNode)(child.props));
    }
    return content(child.props.children);
  }).join('');
}

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

const mention = { type: 'mention', name: '代理日志排查', path: 'codex-thread://logs' };

it.each(['继续这个任务', ''])('renders conversation references in a native user bubble with text "%s"', text => {
  const item: Item = { id: 'user', type: 'userMessage', content: [{ type: 'text', text }, mention] };
  const rendered = content(ChatMessage({ item, onOpen: vi.fn() }));
  expect(rendered).toBe(`引用对话：代理日志排查${text}`);
});

it('restores historical references in the native bubble without showing internal context', () => {
  const envelope = '<codex_gui_conversation_context>' + JSON.stringify({
    kind: 'reference', id: 'logs', name: mention.name, messages: ['PRIVATE CONTEXT'],
  }) + '</codex_gui_conversation_context>';
  const item: Item = { id: 'user', type: 'userMessage', content: ['继续这个任务\n' + envelope] };
  expect(content(ChatMessage({ item, onOpen: vi.fn() }))).toBe('引用对话：代理日志排查继续这个任务');
});

const path = 'C:\\Users\\CXR\\AppData\\Roaming\\dev.codex.switch\\codex-gui-workspaces\\attachments\\'
  + '7e776098-b1d1-45d5-9f8c-7d44602a5e43\\attachment-Screenrecorder-2026-10-25-17-56-11-991.mp4';

it('replaces historical upload paths with an attachment entry and keeps the message intact', () => {
  const text = `看看 顶部状态栏在切换 tab 时 背景显示异常\n文件：${path}`;
  const rendered = content(ChatMessage({ item: { id: 'user', type: 'userMessage', text }, onOpen: vi.fn() }));
  expect(rendered).toBe('1 个附件看看 顶部状态栏在切换 tab 时 背景显示异常');
  expect(rendered).not.toContain(path);
});

it.each(['', `文件：${path}`])('deduplicates file-only live mentions and historical paths: %s', text => {
  const item: Item = { id: 'user', type: 'userMessage', text,
    content: [{ type: 'mention', name: '录屏.mp4', path }, mention] };
  expect(content(ChatMessage({ item, onOpen: vi.fn() }))).toBe('引用对话：代理日志排查1 个附件');
});

it('preserves attachment-looking examples in prose and fenced code', () => {
  const text = '文件：说明文字\n```text\n文件：C:/example.txt\n```';
  expect(content(ChatMessage({ item: { id: 'user', type: 'userMessage', text }, onOpen: vi.fn() }))).toBe(text);
});

it('keeps quoted attachment paths separate from the actual attachment count', () => {
  const text = `引用对话内容：\n> 文件：C:/example.txt\n\n请检查\n文件：${path}`;
  expect(content(ChatMessage({ item: { id: 'user', type: 'userMessage', text }, onOpen: vi.fn() })))
    .toBe('1 个附件请检查');
});
