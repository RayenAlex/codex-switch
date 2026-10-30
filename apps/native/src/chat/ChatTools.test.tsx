import React, { type ReactElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GuiToolsClient } from '../../../../shared/remote-chat/guiTools';
import { ChatTools } from './ChatTools';

const state = vi.hoisted(() => ({ project: 'C:/project' }));
vi.mock('react', async original => ({ ...await original<typeof React>(),
  useState: (initial: unknown) => [initial === undefined ? state.project : initial, vi.fn()],
  useEffect: vi.fn(), useRef: () => ({ current: null }),
}));
vi.mock('react-native', () => ({ Keyboard: {}, Pressable: 'Pressable', Text: 'Text', View: 'View' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('../i18n', () => ({ t: (key: string) => key, useLanguage: vi.fn() }));
vi.mock('../theme/store', () => ({ useThemeColor: () => (value: string) => value }));
vi.mock('../theme/styles', () => ({ createThemedStyles: () => () => ({}) }));
vi.mock('../theme/text', () => ({ textMetrics: () => ({}) }));
vi.mock('./styles', () => ({ useStyles: () => ({}), palette: {} }));
vi.mock('./ChatTerminal', () => ({ ChatTerminal: 'Terminal' }));
vi.mock('./git/ChatGit', () => ({ ChatGit: 'Git' }));
vi.mock('./desktop/RemoteDesktop', () => ({ RemoteDesktop: 'Desktop' }));
vi.mock('./ChatToolsPopover', () => ({ ChatToolsPopover: 'Popover' }));
vi.mock('./portMapping/PortMappings', () => ({ PortMappings: 'Mappings' }));
vi.mock('./ProjectBrowser', () => ({ ProjectBrowser: 'Browser' }));
vi.mock('../../../../shared/remote-chat/useRemoteTerminalLauncher', () => ({
  useRemoteTerminalLauncher: () => ({ tabs: [], busy: false, toggle: vi.fn() }),
}));
vi.mock('../../../../shared/remote-desktop/useDesktopLauncher', () => ({
  useDesktopLauncher: () => ({ opened: true, open: vi.fn(), close: vi.fn() }),
}));

type Tool = ReactElement<{ active: boolean; connected: boolean }>;
const client = { projectBrowser: {}, desktop: {}, files: {} } as GuiToolsClient;
beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

it('keeps stateful tools visible through background and reconnect, while pausing desktop input', () => {
  for (const [foreground, connected] of [[true, true], [false, true], [false, false], [true, true]]) {
    const tree = ChatTools({ client, cwd: state.project, scope: 'device', active: true, foreground, connected });
    const [projectTools, browser, , mappings, desktop] = tree.props.children as Tool[];
    expect(projectTools.props.active).toBe(true);
    expect(browser.props.active).toBe(true);
    expect(mappings.props.active).toBe(true);
    expect(projectTools.props.connected).toBe(connected && foreground);
    expect(browser.props.connected).toBe(connected && foreground);
    expect(desktop.props.active).toBe(foreground);
  }
});

it('still hides tools when leaving the device page', () => {
  const tree = ChatTools({ client, cwd: state.project, scope: 'device', active: false, foreground: true,
    connected: true });
  for (const tool of (tree.props.children as Tool[]).filter(Boolean)) expect(tool.props.active).toBe(false);
});
