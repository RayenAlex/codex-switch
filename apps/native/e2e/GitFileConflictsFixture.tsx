import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { ChatGit } from '../src/chat/git/ChatGit';
import { ChatOverlay } from '../src/chat/ChatOverlay';
import { textMetrics } from '../src/theme/text';
import { createAsyncGitFixture } from '../../../shared/remote-chat/testing/gitFixture';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';

setInterfaceLanguage('zh');
const client = createAsyncGitFixture();
const fileAction = client.fileAction;
client.fileAction = async request => {
  if (request.files.some(file => file.path === 'src/app.ts')) {
    throw new Error(JSON.stringify({ code: 'client.gitActivity.filesBusy', params: {
      details: '修复登录页面中的表单验证和提交状态 (task-login) → src/app.ts\n发布任务 (task-release) → src/app.ts',
    } }));
  }
  return fileAction(request);
};

function App() {
  const [fonts] = useFonts(Ionicons.font);
  const [open, setOpen] = useState(false);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1 }}><ChatOverlay>
    <Pressable accessibilityRole="button" accessibilityLabel="Git" onPress={() => setOpen(true)}>
      <Text style={{ ...textMetrics(18, 28), padding: 20 }}>Git</Text>
    </Pressable>
    {fonts && <ChatGit client={client} cwd="/projects/demo" active={open} connected onClose={() => setOpen(false)} />}
  </ChatOverlay></SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(App);
