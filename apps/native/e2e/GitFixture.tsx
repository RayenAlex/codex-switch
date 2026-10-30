import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { ChatTools } from '../src/chat/ChatTools';
import { ChatOverlay } from '../src/chat/ChatOverlay';
import { createGuiToolsClient } from '../../../shared/remote-chat/guiTools';
import { createAsyncGitFixture } from '../../../shared/remote-chat/testing/gitFixture';
import { setInterfaceLanguage } from "../../../shared/localization/interfaceLanguage";

setInterfaceLanguage('zh');

function App() {
  const [fonts] = useFonts(Ionicons.font);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  const client = useMemo(() => ({ ...createGuiToolsClient(async <T,>() => [] as T), git: createAsyncGitFixture() }), []);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#f4f4f4' }}>
    <ChatOverlay>
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
      <Text style={{ flex: 1 }}>Git tools fixture</Text>
      {fonts && <ChatTools client={client} cwd="/projects/demo" scope="git-fixture" active connected
        foreground={foreground} deviceName="测试电脑" />}
    </View>
    </ChatOverlay>
  </SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(App);
