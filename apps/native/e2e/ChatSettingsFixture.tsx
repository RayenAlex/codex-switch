import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatSettings } from '../src/chat/ChatSettings';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';
import { initialSettings, settingsFixture } from '../../../shared/remote-chat/testing/settingsFixture';
import { textMetrics } from '../src/theme/text';
import { t } from '../src/i18n';

setInterfaceLanguage('zh');

function ChatSettingsFixture() {
  const [fontsReady] = useFonts(Feather.font);
  const [open, setOpen] = useState(true);
  const [selection, setSelection] = useState(initialSettings);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#f4f4f4', padding: 20 }}>
    <Pressable onPress={() => setOpen(true)} accessibilityRole="button"
      accessibilityLabel={t('client.chat.chatSettings.1e06eb')}>
      <Text style={{ ...textMetrics(20, 30), color: '#17211b' }}>{t('client.chat.chatSettings.1e06eb')}</Text>
    </Pressable>
    {open && fontsReady && <ChatSettings {...settingsFixture} selection={selection} usageActive
      updateSettings={async patch => setSelection(current => ({ ...current, ...patch }))}
      onClose={() => setOpen(false)} />}
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(ChatSettingsFixture);
