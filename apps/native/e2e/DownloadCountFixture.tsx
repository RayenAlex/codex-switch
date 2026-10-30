import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useEffect, useState } from 'react';
import { Button, DeviceEventEmitter, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../src/discovery/BottomNavigation';
import { DiscoveryPage } from '../src/discovery/DiscoveryPage';
import { DownloadManagerPage } from '../src/downloads/DownloadManagerPage';
import { downloadManager, downloadOwner } from '../src/downloads/manager';
import type { DownloadTask } from '../src/downloads/types';
import type { AuthSession } from '../src/types';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';

setInterfaceLanguage('zh');
const session: AuthSession = { baseUrl: 'https://download.test', email: 'fixture@download.test',
  accessToken: 'fixture', refreshToken: 'fixture' };
const owner = downloadOwner(session);
function update(count: number, status: DownloadTask['status'] = 'downloading') {
  const tasks: DownloadTask[] = Array.from({ length: count }, (_, index) => ({
    id: `fixture-${index}`, name: `文件-${index}.zip`, status, received: 0, size: 100, createdAt: 0, message: '',
    source: { owner, deviceId: 'pc', deviceName: 'PC', scope: 'computer', path: `file-${index}.zip` },
  }));
  DeviceEventEmitter.emit('downloadTasksChanged', JSON.stringify(tasks));
}

function DownloadCountFixture() {
  const [page, setPage] = useState('discover');
  const [other, setOther] = useState(false);
  const visibleOwner = other ? 'other' : owner;
  useEffect(() => { void downloadManager.initialize().then(() => update(2)); }, []);
  return <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      <Button title="12 tasks" onPress={() => update(12)} />
      <Button title="Pause" onPress={() => update(12, 'paused')} />
      <Button title="Finish" onPress={() => update(12, 'completed')} />
      <Button title="Clear" onPress={() => update(0)} />
      <Button title="Account" onPress={() => setOther(value => !value)} />
    </View>
    <View style={{ flex: 1 }}>
      {page === 'discover' && <DiscoveryPage owner={visibleOwner} onOpen={setPage} />}
      {page === 'downloads' && <DownloadManagerPage session={session} onBack={() => setPage('discover')} />}
    </View>
    {page !== 'downloads' && <BottomNavigation owner={visibleOwner} activePage={page} onChange={setPage} />}
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(DownloadCountFixture);
