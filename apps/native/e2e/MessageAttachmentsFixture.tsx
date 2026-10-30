import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { ChatMessage } from '../src/chat/ChatMessage';
import { ChatFileContext } from '../src/chat/ChatFilePreview';
import { AttachmentMetadataContext } from '../../../shared/chat/attachmentMetadata';
import { BottomSheet } from '../src/components/BottomSheet';
import { textMetrics } from '../src/theme/text';
import { updateThemeMode, useThemeMode } from '../src/theme/store';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';

const path = 'C:\\Users\\CXR\\AppData\\Roaming\\dev.codex.switch\\codex-gui-workspaces\\attachments\\'
  + '7e776098-b1d1-45d5-9f8c-7d44602a5e43\\attachment-顶部状态栏录屏-2026-10-25-17-56-11-991.mp4';
const readMetadata = async (path: string) => ({ path, name: path.split(/[\\/]/).at(-1)!, size: 2048,
  directory: false, modifiedAt: 1792900000000 });

function Fixture() {
  const [fonts] = useFonts(Ionicons.font);
  const [preview, setPreview] = useState('');
  const theme = useThemeMode();
  const color = theme === 'dark' ? '#e8eee9' : '#17211b';
  if (!fonts) return null;
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1,
    backgroundColor: theme === 'dark' ? '#121513' : '#f4f4f4' }}>
    <View style={{ padding: 16, flexDirection: 'row', gap: 20 }}>
      <Pressable accessibilityLabel="Theme" onPress={() => updateThemeMode(theme === 'dark' ? 'light' : 'dark')}>
        <Text style={{ color, ...textMetrics(14, 22) }}>Theme</Text>
      </Pressable>
      {(['zh', 'en'] as const).map(language => <Pressable key={language}
        accessibilityLabel={language} onPress={() => setInterfaceLanguage(language)}>
        <Text style={{ color, ...textMetrics(14, 22) }}>{language}</Text>
      </Pressable>)}
    </View>
    <AttachmentMetadataContext.Provider value={readMetadata}>
    <ChatFileContext.Provider value={file => setPreview(file.path)}>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
      <ChatMessage item={{ id: 'historical', type: 'userMessage',
        text: `看看 顶部状态栏在切换 tab 时 背景显示异常\n文件：${path}` }} onOpen={() => {}} />
      <ChatMessage item={{ id: 'file-only', type: 'userMessage', content: [
        { type: 'mention', name: '诊断日志.jsonl', path: '/tmp/诊断日志.jsonl' },
      ] }} onOpen={() => {}} />
      <ChatMessage item={{ id: 'mixed', type: 'userMessage',
        text: '请一起检查\n文件：/tmp/报告.txt\n文件夹：/tmp/project',
        content: [{ type: 'mention', name: '之前的排查', path: 'codex-thread://previous' }],
      }} onOpen={() => {}} />
    </ScrollView>
    </ChatFileContext.Provider></AttachmentMetadataContext.Provider>
    {!!preview && <BottomSheet visible title="Preview" onClose={() => setPreview('')}>
      <Text testID="opened-file" style={{ ...textMetrics(14, 22), color }}>{preview}</Text>
    </BottomSheet>}
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(Fixture);
