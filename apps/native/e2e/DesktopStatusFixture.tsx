import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { DesktopClient } from '../../../shared/remote-desktop/protocol';
import { RemoteDesktop } from '../src/chat/desktop/RemoteDesktop';
import { textMetrics } from '../src/theme/text';
import { t } from '../src/i18n';
import { SecuritySettings } from '../src/chat/desktop/SecuritySettings';
import { useTerminalOrientation } from '../src/chat/terminal/useTerminalOrientation';

const connectingClient: DesktopClient = {
  open: () => new Promise(() => undefined),
  signal: async () => ({ candidates: [] }),
  settings: async () => undefined,
  close: async () => undefined,
};
const permissionClient: DesktopClient = {
  ...connectingClient,
  open: async () => { throw new Error('请在 Mac 的远程设置中开启屏幕录制权限，然后重新连接。'); },
  permissionStatus: async () => ({ required: 'screenRecording' }),
};
const reconnectingClient: DesktopClient = {
  ...connectingClient,
  open: async () => { throw new Error(t('client.remoteDesktop.connectionLostReconnecting')); },
};
const refused = (message: string): DesktopClient => ({ ...connectingClient,
  open: async () => { throw new Error(message); } });
const clients = { connecting: connectingClient, reconnecting: reconnectingClient, permission: permissionClient,
  locked: refused('client.remoteDesktop.lockedRequiresUnattended'),
  privacy: refused('client.remoteDesktop.privacyRequiresUnattended'),
  privacyFailed: refused('client.remoteDesktop.privacyFailed') };

function SecurityGuidance({ close }: { close: () => void }) {
  const [message, setMessage] = useState('');
  const orientation = useTerminalOrientation(true, { initialLandscape: true });
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }}>
    <SecuritySettings connected control supported value={{ lockOnDisconnect: false, muteHost: false }}
      saving={false} error="" update={async () => true}
      privacy={{ available: true, enabled: false,
        toggle: async () => { setMessage('client.remoteDesktop.privacyRequiresUnattended'); } }}
      clipboard={{ available: true, enabled: false, toggle: () => {} }}
      clipboardActions={{ busy: false, status: '', copy: () => {}, paste: () => {} }}
      notice={message ? { message, label: 'client.mobile.reconnect', run: () => {} } : undefined} close={close} />
  </View><Pressable accessibilityRole="button" onPress={orientation.rotate}>
    <Text style={textMetrics(14, 22)}>{t('client.mobile.rotate')}</Text>
  </Pressable></View>;
}

function DesktopStatusFixture() {
  const [fonts] = useFonts({ ...Ionicons.font, ...MaterialCommunityIcons.font });
  const [scenario, setScenario] = useState<keyof typeof clients | 'security' | null>(null);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1 }}>
    {scenario !== 'security' && <View style={{ padding: 24, gap: 12 }}>
      <Text testID="status-line-reference"
        style={textMetrics(14, 22)}>{t('client.mobile.reconnect')}</Text>
      <Pressable accessibilityRole="button" onPress={() => setScenario('connecting')}>
        <Text>Connecting status</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setScenario('permission')}>
        <Text>Permission status</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setScenario('reconnecting')}>
        <Text>Reconnecting status</Text>
      </Pressable>
      {(['locked', 'privacy', 'privacyFailed', 'security'] as const).map(name =>
        <Pressable key={name} accessibilityRole="button" onPress={() => setScenario(name)}>
          <Text style={textMetrics(14, 22)}>{name} status</Text></Pressable>)}
    </View>}
    {fonts && scenario === 'security' && <SecurityGuidance close={() => setScenario(null)} />}
    {fonts && scenario && scenario !== 'security' && <RemoteDesktop active
      client={clients[scenario]} close={() => setScenario(null)} />}
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(DesktopStatusFixture);
