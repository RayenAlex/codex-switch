import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RemoteDevice } from '../types';
import type { ChatState } from './types';
import type { ChatController } from '../../../../shared/remote-chat/client/controller';
import { ChatReconnectButton } from './ChatReconnectButton';
import { HOST_IDENTITY_CHANGED } from '../../../../shared/remote-chat/trustedHost';
import { HostIdentityVerification } from './HostIdentityVerification';
import { ChatConnectionHealth } from './ChatConnectionHealth';
import { useConnectionInfoStyles } from './connectionInfoStyles';

const modeLabels = { get connecting() { return t("client.settings.connecting"); }, direct: 'P2P', relay: 'Relay', get offline() { return t("client.chat.waitingToReconnect"); } };

export function ChatConnectionInfo({ state, controller, device, active }: {
  state: ChatState; controller: ChatController; device?: RemoteDevice; active: boolean;
}) {
  const styles = useConnectionInfoStyles();
  useLanguage();
  const [verifying, setVerifying] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const canReconnect = active && device && !state.ready && !state.connecting && state.mode !== 'connecting';
  let status = modeLabels[state.mode];
  if (!state.ready && (state.mode === 'direct' || state.mode === 'relay')) status = t("client.chat.syncingChats");
  if (!state.ready && state.error && !state.connecting) status = t("client.chat.connectionIncomplete");
  return <>
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.text, styles.name]}>
          {device ? device.name : t("client.chat.chooseAComputerToStartChatting")}</Text>
        {device && <Pressable accessibilityRole="button" style={styles.status}
          accessibilityLabel={`${status} · ${t("client.chatReliability.connectionCheck")}`} accessibilityState={{ expanded: healthOpen }}
          onPress={() => setHealthOpen(true)}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.text}>{' · '}{status}</Text>
        </Pressable>}
      </View>
      <View style={styles.actions}>
        {state.error === HOST_IDENTITY_CHANGED && <Pressable style={styles.action}
          onPress={() => setVerifying(true)} accessibilityRole="button">
          <Text style={styles.actionText}>{t("client.remoteDesktop.verifyComputerIdentity")}</Text>
        </Pressable>}
        {canReconnect && <ChatReconnectButton retryAt={state.retryAt} onPress={controller.connectNow} />}
      </View>
    </View>
    {active && healthOpen && <ChatConnectionHealth state={state} device={device}
      reconnect={controller.connectNow} close={() => setHealthOpen(false)} />}
    {active && verifying && <HostIdentityVerification
      confirm={controller.confirmHostIdentity} close={() => setVerifying(false)} />}
  </>;
}
