import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useContext } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatFileContext, ChatFileProvider } from '../src/chat/ChatFilePreview';
import { textMetrics } from '../src/theme/text';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';
import { updateThemeMode } from '../src/theme/store';

setInterfaceLanguage('zh');
updateThemeMode('dark');

const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<style>body{margin:0;background:#101719;color:#e6eeee;font:18px sans-serif}header{padding:24px;'
  + 'border-bottom:1px solid #52645b}main{height:100vh;display:grid;place-items:center}button{padding:16px}</style>'
  + '</head><body><header>在线交流 · 文件预览</header><main><button onclick="this.textContent=\'已点击\'">'
  + '保留预览状态</button></main><footer>预览底部</footer></body></html>';
const samples: Record<string, string> = {
  '页面预览.html': html,
  '说明文档.md': '# 文件预览\n\n' + '中文内容可以完整阅读，长文档支持滚动。\n\n'.repeat(40) + '文档底部',
  '代码预览.ts': 'const ready = true;\n'.repeat(100),
  '安装包.apk': '',
};
const client = {
  open: async () => { throw new Error('Fixture does not download'); },
  read: async () => { throw new Error('Fixture does not download'); },
  close: async () => {},
};
const load = async (_threadId: string, path: string) => ({ path, text: samples[path.split(/[\\/]/).at(-1)!] });

function Links() {
  const open = useContext(ChatFileContext);
  return <>{Object.keys(samples).map(name => <Pressable key={name} accessibilityRole="button"
    accessibilityLabel={name} onPress={() => open?.({ path: `C:/测试/附件/${name}` })} style={{ padding: 20 }}>
    <Text style={{ ...textMetrics(18, 28), color: '#ffffff' }}>{name}</Text>
  </Pressable>)}</>;
}

function FilePreviewFixture() {
  const [fontsReady] = useFonts(MaterialCommunityIcons.font);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#101719' }}>
    {fontsReady && <ChatFileProvider threadId="preview-fixture" ready files={client} videos={client} load={load}>
      <Links />
    </ChatFileProvider>}
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(FilePreviewFixture);
