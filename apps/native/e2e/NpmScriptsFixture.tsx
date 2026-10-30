import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';
import { createGuiToolsClient } from '../../../shared/remote-chat/guiTools';
import type { ProjectBrowserRequest } from '../../../shared/project-browser/protocol';
import { browserRequest, browserRoot, seedNpmScripts } from '../../desktop/e2e/project-browser-fixture';
import { ChatTools } from '../src/chat/ChatTools';
import { ChatOverlay } from '../src/chat/ChatOverlay';
import { setFileAutoSave } from '../src/settings/filePreferences';
import { npmScriptTerminalFixture } from './npmScriptTerminalFixture';

setInterfaceLanguage('zh');
void setFileAutoSave(0);
seedNpmScripts();
const client = { ...createGuiToolsClient(<T,>(request: object) => browserRequest<T>(request as ProjectBrowserRequest)),
  terminal: npmScriptTerminalFixture() };

function Fixture() {
  const [fonts] = useFonts(Ionicons.font);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <ChatOverlay>
      {fonts && <ChatTools client={client} cwd={browserRoot} scope="npm-script-fixture" active connected />}
    </ChatOverlay>
  </SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(Fixture);
