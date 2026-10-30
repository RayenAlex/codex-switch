import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WebViewProps } from 'react-native-webview';
import type { ProjectBrowserClient } from '../../../../shared/project-browser/protocol';
import { ProjectBrowser } from './ProjectBrowser';
import { readBrowserSession } from './projectBrowserSessions';

const runtime = vi.hoisted(() => ({
  cursor: 0, state: [] as unknown[], refs: [] as { current: unknown }[], refCursor: 0,
  inject: vi.fn(),
}));
vi.mock('react', async original => ({ ...await original<typeof React>(),
  useEffect: vi.fn(), useMemo: <T,>(create: () => T) => create(),
  useState: (initial: unknown) => {
    const slot = runtime.cursor++;
    if (!(slot in runtime.state)) runtime.state[slot] = initial;
    return [runtime.state[slot], (value: unknown) => { runtime.state[slot] = value; }];
  },
  useRef: (initial: unknown) => {
    const slot = runtime.refCursor++;
    runtime.refs[slot] ??= { current: slot === 0 ? { injectJavaScript: runtime.inject } : initial };
    return runtime.refs[slot];
  },
}));
vi.mock('react-native', () => ({ ActivityIndicator: 'Spinner', KeyboardAvoidingView: 'View',
  Modal: 'Modal', Platform: { OS: 'android' }, Pressable: 'Button', Text: 'Text', View: 'View' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: 'View', SafeAreaView: 'View' }));
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('expo-asset', () => ({ Asset: {} }));
vi.mock('expo-file-system', () => ({ readAsStringAsync: vi.fn() }));
vi.mock('../i18n', () => ({ t: (key: string) => key, displayText: (key: string) => key,
  displayError: (key: string) => key, useLanguage: () => 'en' }));
vi.mock('../theme/store', () => ({ useThemeColor: () => (value: string) => value, useThemeMode: () => 'light' }));
vi.mock('../theme/styles', () => ({ createThemedStyles: () => () => ({}) }));
vi.mock('../theme/text', () => ({ textMetrics: () => ({}) }));
vi.mock('../theme/useWebviewSource', () => ({ useWebviewSource: (html: string) => ({ html }) }));
vi.mock('../settings/filePreferences', () => ({ useFilePreferences: () => ({ ready: true, delay: 0 }),
  setFileAutoSave: vi.fn() }));
vi.mock('./projectBrowserHost', () => ({ projectBrowserHost: () => ({}) }));
vi.mock('../../../../shared/chat/ChatFileReferences', () => ({
  useChatFileReference: () => vi.fn(), useChatFileSelection: () => vi.fn(),
}));

function descendants(tree: ReactNode): ReactElement<WebViewProps & { children?: ReactNode }>[] {
  return Children.toArray(tree).flatMap(child => isValidElement<WebViewProps & { children?: ReactNode }>(child)
    ? [child, ...descendants(child.props.children)] : []);
}
const render = (client: ProjectBrowserClient, close = vi.fn()) => {
  runtime.cursor = 0; runtime.refCursor = 0;
  const tree = ProjectBrowser({ client, cwd: '/project', active: true, connected: true, onClose: close });
  return descendants(tree).find(child => child.type === 'WebView')!;
};
const receive = (view: ReactElement<WebViewProps>, message: object) =>
  view.props.onMessage!({ nativeEvent: { data: JSON.stringify(message) } } as
    Parameters<NonNullable<WebViewProps['onMessage']>>[0]);
const client = (): ProjectBrowserClient => ({ list: vi.fn(), read: vi.fn(), save: vi.fn(), mutate: vi.fn() });

beforeEach(() => {
  vi.stubGlobal('React', React); vi.clearAllMocks();
  runtime.refs = []; runtime.state = ['<html/>', '', true, 0];
});
afterEach(() => vi.unstubAllGlobals());

it('keeps checkpoints before close and restores them after renderer termination', () => {
  const api = client(); const close = vi.fn(); const view = render(api, close);
  const snapshot = { tabs: [], activePath: '/project/draft.ts' };
  receive(view, { type: 'snapshot', cwd: '/project', snapshot });
  expect(readBrowserSession(api, '/project')).toEqual(snapshot);
  expect(close).not.toHaveBeenCalled();
  view.props.onRenderProcessGone!({} as Parameters<NonNullable<WebViewProps['onRenderProcessGone']>>[0]);
  const recovered = render(api, close);
  expect(recovered.key).not.toBe(view.key);
  receive(recovered, { type: 'ready' });
  expect(runtime.inject).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(snapshot)));
  receive(view, { type: 'snapshot', cwd: '/project', snapshot: { tabs: [] } });
  receive(recovered, { type: 'snapshot', cwd: '/other', snapshot: { tabs: [] } });
  expect(readBrowserSession(api, '/project')).toEqual(snapshot);
});

it('ignores old request replies after the renderer restarts with new request IDs', async () => {
  const api = client();
  let resolve!: (value: Awaited<ReturnType<ProjectBrowserClient['list']>>) => void;
  vi.mocked(api.list).mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(api);
  receive(view, { type: 'request', id: 1, action: 'list', body: { directory: '/project' } });
  view.props.onContentProcessDidTerminate!({} as
    Parameters<NonNullable<WebViewProps['onContentProcessDidTerminate']>>[0]);
  render(api);
  runtime.inject.mockClear();
  resolve({ entries: [], truncated: false, directory: '/project', parent: null });
  await vi.waitFor(() => expect(api.list).toHaveResolved());
  expect(runtime.inject).not.toHaveBeenCalled();
});
