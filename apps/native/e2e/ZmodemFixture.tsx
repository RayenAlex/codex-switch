// Disposable SSH fixture only; adb reverse maps its loopback port to the local Rust bridge.
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { textMetrics } from '../src/theme/text';
import { SshHostKeyFixture } from './SshHostKeyFixture';
import { TerminalSession } from '../src/chat/terminal/TerminalSession';
import { createGuiToolsClient } from '../../../shared/remote-chat/guiTools';
import type { TerminalInfo } from '../../../shared/terminal/types';

const base = 'http://127.0.0.1:1518';
async function rpc<T>(request: object): Promise<T> {
  const response = await fetch(`${base}/rpc`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request) });
  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.data;
}
const client = createGuiToolsClient(async <T,>(request: object): Promise<T> => {
  const body = request as { operation: string; id: string; data?: unknown; size?: unknown; cursor?: number };
  if (body.operation === 'guiTerminalBinaryMode') return undefined as T;
  if (body.operation === 'guiTerminalRead') {
    const response = await fetch(`${base}/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: body.id, cursor: body.cursor }) });
    return response.json();
  }
  const types: Record<string, string> = { guiTerminalWrite: 'write', guiTerminalWriteBinary: 'writeBinary',
    guiTerminalResize: 'resize', guiTerminalClose: 'close' };
  if (!types[body.operation]) throw new Error('Unsupported fixture request');
  return rpc({ type: 'command', request: { type: types[body.operation], id: body.id,
    ...(body.data === undefined ? {} : { data: body.data }), ...(body.size ? { size: body.size } : {}) } });
}).terminal;

function App() {
  const [fonts] = useFonts(Ionicons.font);
  const [visible, setVisible] = useState(false);
  const [session, setSession] = useState<TerminalInfo>();
  const [error, setError] = useState('');
  useEffect(() => {
    void (async () => {
      const fixture = await (await fetch(`${base}/config`)).json();
      const endpoint = { host: fixture.host, port: fixture.port };
      const fingerprint = await rpc<string>({ type: 'probe', endpoint });
      setSession(await rpc({ type: 'open', request: { endpoint, fingerprint, username: fixture.username,
        password: fixture.password, size: { cols: 80, rows: 24 } } }));
    })().catch(reason => setError(String(reason)));
  }, []);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1 }}><Text style={textMetrics(16, 24)}>{error}</Text>
    <Button title="Open transfer terminal" onPress={() => setVisible(true)} />
    <SshHostKeyFixture />
    {session && fonts && <TerminalSession client={client} session={session} visible={visible}
      hide={() => setVisible(false)} deviceName="ZMODEM fixture" tabs={<View>
        <Button title="RZ upload" onPress={() => { void client.write(session.id, 'rz\r'); }} />
        <Button title="SZ download" onPress={() => {
          void client.write(session.id, 'sz android-zmodem-test.bin\r');
        }} />
      </View>} />}
  </SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(App);
