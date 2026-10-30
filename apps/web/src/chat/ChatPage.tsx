import { t, useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { useAppDispatch } from '../hooks';
import { chatDeviceSelected } from '../store';
import type { AuthSession, RemoteDevice } from '../types';
import { ConnectedChat } from './ConnectedChat';
import { ChatTools } from './ChatTools';
import { useChat } from './useChat';
import { useChatViewport } from './useChatViewport';
import { loadLastConnectedDevice, saveLastConnectedDevice } from './lastConnectedDevice';
import { useDownloadConnection } from '../downloads/useDownloadConnection';
import { useRetainedChatDevices } from '../../../../shared/remote-chat/useRetainedChatDevices';
import type { ComputerListRefresh } from '../../../../shared/remote-chat/ComputerSearchBar';
import { useComputerListRefresh } from './useComputerListRefresh';
import { useDesktopLayout } from '../useDesktopLayout';
import { useRemoteCliInstaller } from '../../../../shared/remote-chat/useRemoteCliInstaller';
import { GuiRemoteDesktop } from '../../../desktop/src/pages/codexGui/GuiRemoteDesktop';
import { RemoteGuiTools } from '../../../desktop/src/pages/codexGui/remote/RemoteGuiTools';
import { RemoteGuiProject } from '../../../desktop/src/pages/codexGui/remote/RemoteGuiProject';
import './desktopTools.css';

interface Props { session: AuthSession; devices: RemoteDevice[]; active: boolean }

export function ChatPage({ session, devices, active }: Props) {
  useLanguage();
  const dispatch = useAppDispatch();
  const deviceRefresh = useComputerListRefresh();
  const [lastConnectedDeviceId] = useState(() => loadLastConnectedDevice(session));
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const device = devices.find((entry) => entry.deviceId === deviceId)
    ?? devices.find((entry) => entry.deviceId === lastConnectedDeviceId && entry.online)
    ?? devices.find((entry) => entry.online);
  useEffect(() => {
    if (device && deviceId !== device.deviceId) setDeviceId(device.deviceId);
  }, [deviceId, device?.deviceId]);
  useEffect(() => {
    dispatch(chatDeviceSelected(device?.deviceId ?? null));
  }, [dispatch, device?.deviceId]);
  useChatViewport(active);
  const scope = JSON.stringify([session.baseUrl, session.email]);
  const retained = useRetainedChatDevices({ scope, devices, selectedId: device?.deviceId });
  const chats = device ? retained : [...retained, undefined];
  return <section className="chat-page" hidden={!active} aria-label={t("Codex 聊天")}>
    {chats.map(chatDevice => {
      const selected = chatDevice?.deviceId === device?.deviceId;
      return <div className="chat-device-session" hidden={!selected}
        key={JSON.stringify([scope, chatDevice?.deviceId])}>
        <WebChat session={session} device={chatDevice} devices={devices} selected={selected}
          active={active && selected} chooseDevice={setDeviceId} deviceRefresh={deviceRefresh} />
      </div>;
    })}
  </section>;
}

function WebChat({ session, device, selected, ...props }: Props & {
  device?: RemoteDevice; selected: boolean; chooseDevice: (id: string) => void;
  deviceRefresh: ComputerListRefresh;
}) {
  const chat = useChat(session, device?.deviceId ?? '', props.active && Boolean(device));
  const desktop = useDesktopLayout();
  const installer = useRemoteCliInstaller(chat.controller.guiTools,
    desktop && props.active && chat.foreground && chat.state.ready);
  useEffect(() => {
    if (selected && chat.state.ready && device) saveLastConnectedDevice(session, device.deviceId);
  }, [selected, chat.state.ready, device?.deviceId, session.baseUrl, session.email]);
  useDownloadConnection({ session, deviceId: device?.deviceId ?? '', deviceName: device?.name ?? '',
    controller: chat.controller, enabled: selected });
  return <ConnectedChat {...props} chat={chat} device={device} email={session.email}
    cliVersion={installer.version}
    composerHeader={desktop && <RemoteGuiProject state={chat.state} controller={chat.controller}
      active={props.active && chat.foreground} computers={{ ...props.deviceRefresh, allowLocal: false,
        current: device ?? null, devices: props.devices, authenticated: true, login: () => {},
        choose: selected => { if (selected) props.chooseDevice(selected.deviceId); } }} />}
    headerActions={<div className="chat-header-tools">
      <ChatTools client={chat.controller.guiTools} active={props.active}
        desktopActions={<><GuiRemoteDesktop client={chat.controller.guiTools.desktop} active={props.active}
          connected={chat.state.mode === 'direct' || chat.state.mode === 'relay'} />
          <RemoteGuiTools controller={chat.controller} state={chat.state} installer={installer} /></>}
        connected={chat.state.ready} deviceName={device?.name}
        cwd={chat.state.selected?.cwd ?? chat.state.draftProject?.cwd ?? ''} />
    </div>}
    scope={JSON.stringify([session.baseUrl, session.email, device?.deviceId ?? ''])} />;
}
