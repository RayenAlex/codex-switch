import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GuiToolsClient } from '../../../../shared/remote-chat/guiTools';
import { useDesktopLauncher } from '../../../../shared/remote-desktop/useDesktopLauncher';
import { ChatTerminal } from './ChatTerminal';
import { ChatGit } from './git/ChatGit';
import { RemoteDesktop } from './desktop/RemoteDesktop';
import { ChatToolsPopover } from './ChatToolsPopover';
import { PortMappings } from './portMapping/PortMappings';
import type { AuthSession } from '../types';
import { palette, useStyles } from './styles';
import { ProjectBrowser } from './ProjectBrowser';
import type { DownloadClient } from '../../../../shared/remote-chat/downloads';
import { useRemoteTerminalLauncher } from '../../../../shared/remote-chat/useRemoteTerminalLauncher';

interface Props {
  client: GuiToolsClient; cwd: string; active: boolean; connected: boolean; deviceName?: string;
  foreground?: boolean;
  scope: string; session?: AuthSession;
  downloads?: DownloadClient;
}
export function ChatTools(props: Props) {
  useLanguage();
  const [mapping, setMapping] = useState(false);
  const [project, setProject] = useState<string>();
  const desktop = useDesktopLauncher();
  // App backgrounding pauses live work without disposing stateful modal contents on Android.
  const live = props.active && (props.foreground ?? true);
  const terminalCwd = project ?? props.cwd;
  const terminal = useRemoteTerminalLauncher({ client: props.client.terminal, cwd: terminalCwd,
    connected: props.connected && live });
  const terminalView = <ChatTerminal {...props} client={props.client.terminal} cwd={terminalCwd}
    connected={props.connected && live} panel={terminal} hideTrigger />;
  return <>
    <ProjectTools key={props.cwd} {...props} connected={props.connected && live}
      openMappings={() => setMapping(true)}
      openDesktop={desktop.open}
      openTerminal={() => { Keyboard.dismiss(); terminal.toggle(); }}
      openFiles={() => setProject(value => value ?? props.cwd)} />
    {project && <ProjectBrowser client={props.client.projectBrowser} cwd={project}
      active={props.active} connected={props.connected && live} onClose={() => setProject(undefined)}
      scripts={terminal}>{terminalView}</ProjectBrowser>}
    {!project && terminalView}
    <PortMappings client={props.client.files} scope={props.scope} connected={props.connected} session={props.session}
      active={props.active} deviceName={props.deviceName} open={mapping} close={() => setMapping(false)} />
    {desktop.opened && <RemoteDesktop client={props.client.desktop} active={live}
      close={desktop.close} />}
  </>;
}

function ProjectTools({ client, ...props }: Props & {
  openMappings: () => void; openFiles: () => void; openDesktop: () => void; openTerminal: () => void;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  const menuStyles = useMenuStyles();
  useLanguage();
  const anchor = useRef<View>(null);
  const [menu, setMenu] = useState(false);
  const [git, setGit] = useState(false);
  useEffect(() => { if (!props.active || props.foreground === false) setMenu(false); },
    [props.active, props.foreground]);
  return <>
    <Pressable ref={anchor} collapsable={false} accessibilityRole="button" accessibilityLabel={t("client.git.openTools")}
      accessibilityState={{ expanded: menu && props.active }}
      style={styles.back} onPress={() => { Keyboard.dismiss(); setMenu(value => !value); }}>
      <Ionicons name="construct-outline" size={24} color={color(palette.ink, 'ink')} /></Pressable>
    {menu && props.active && <ChatToolsPopover anchor={anchor} close={() => setMenu(false)}>
      <Pressable accessibilityRole="button" style={({ pressed }) => [menuStyles.item, pressed && menuStyles.pressed]}
        onPress={() => { setMenu(false); props.openMappings(); }}>
        <Ionicons name="swap-horizontal-outline" size={20} color={color(palette.ink, 'ink')} />
        <Text style={menuStyles.label}>{t("client.portForwarding.portMapping")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={!props.connected}
        accessibilityState={{ disabled: !props.connected }}
        style={({ pressed }) => [menuStyles.item, pressed && menuStyles.pressed, !props.connected && styles.disabled]}
        onPress={() => { setMenu(false); props.openDesktop(); }}>
        <Ionicons name="desktop-outline" size={20} color={color(palette.ink, 'ink')} />
        <Text style={menuStyles.label}>{t("client.remoteDesktop.remoteDesktop")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={!props.connected}
        accessibilityState={{ disabled: !props.connected }}
        style={({ pressed }) => [menuStyles.item, pressed && menuStyles.pressed, !props.connected && styles.disabled]}
        onPress={() => { setMenu(false); props.openTerminal(); }}>
        <Ionicons name="terminal-outline" size={20} color={color(palette.ink, 'ink')} /><Text style={menuStyles.label}>{t("client.projectBrowser.terminal")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={({ pressed }) => [menuStyles.item, pressed && menuStyles.pressed]}
        onPress={() => { setMenu(false); setGit(true); }}>
        <Ionicons name="git-branch-outline" size={20} color={color(palette.ink, 'ink')} /><Text style={menuStyles.label}>Git</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={!props.connected || !props.cwd}
        accessibilityState={{ disabled: !props.connected || !props.cwd }}
        style={({ pressed }) => [menuStyles.item, pressed && menuStyles.pressed,
          (!props.connected || !props.cwd) && styles.disabled]}
        onPress={() => { setMenu(false); props.openFiles(); }}>
        <Ionicons name="folder-open-outline" size={20} color={color(palette.ink, 'ink')} />
        <Text style={menuStyles.label}>{t("client.projectBrowser.browseFiles")}</Text>
      </Pressable>
    </ChatToolsPopover>}
    {git && <ChatGit {...props} client={client.git} onClose={() => setGit(false)} />}
  </>;
}

const useMenuStyles = createThemedStyles((color) => ({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44,
    borderRadius: 8, padding: 12 },
  pressed: { backgroundColor: color('#eef4f1', 'canvas') },
  label: { color: color(palette.ink, 'ink'), ...textMetrics(14, 20), flexShrink: 1 },
}));
