import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatComposer } from '../src/chat/ChatComposer';
import { ChatOverlay } from '../src/chat/ChatOverlay';
import { textMetrics } from '../src/theme/text';
import { initialSettings, settingsFixture } from '../../../shared/remote-chat/testing/settingsFixture';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';

setInterfaceLanguage('zh');

function DocumentPickerFixture() {
  const [fontsReady] = useFonts(Feather.font);
  const [selection, setSelection] = useState(initialSettings);
  const [sent, setSent] = useState('');
  if (!fontsReady) return null;
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#f4f4f4' }}>
    <ChatOverlay>
      <View style={{ flex: 1, padding: 24 }}>
        <Text testID="sent" style={textMetrics(16, 24)}>{sent}</Text>
      </View>
      <ChatComposer {...settingsFixture} selection={selection} active ready usageActive
        settingsBusy={false} settingsError="" sending={false} running={false}
        updateSettings={async patch => setSelection(current => ({ ...current, ...patch }))}
        send={async input => { setSent(JSON.stringify(input)); return true; }} interrupt={async () => {}}
        catalog={{ skills: [], loaded: true, loading: false, error: '', refresh: () => {} }}
        cwd="/fixture" compactReason={null} compacting={false} compact={async () => true}
        loadCatalog={async () => ({ data: [] })}
        loadFiles={async () => ({ directory: '/fixture', entries: [], parent: null, truncated: false })}
        loadConversations={async () => ({ data: [], nextCursor: null })} />
    </ChatOverlay>
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(DocumentPickerFixture);
