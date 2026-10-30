import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatProfileMenu } from '../src/chat/ChatProfileMenu';
import { ChatDesktopAccountPicker } from '../src/chat/ChatDesktopAccountPicker';
import { RemoteAccountPicker } from '../../desktop/src/pages/codexGui/remote/RemoteAccountPicker';
import { ChatSidebar } from '../src/chat/ChatSidebar';
import { useDesktopLayout } from '../src/useDesktopLayout';
import type { GuiAccountsClient } from '../../../shared/remote-chat/guiAccounts';
import { createGuiToolsClient } from '../../../shared/remote-chat/guiTools';
import '../src/styles.css';
import '../src/chat/chat.css';

const client: GuiAccountsClient = {
  read: async () => (await fetch('/web/accounts-fixture.json')).json(),
  select: async selection => (await fetch('/web/account-selection.json', {
    method: 'POST', body: JSON.stringify(selection),
  })).json(),
  subscribe: () => () => {},
};
const guiTools = createGuiToolsClient(async () => { throw new Error('Unused in this fixture'); });
const devices = [
  { deviceId: 'work', name: '工作电脑', online: true, platform: 'windows' },
  { deviceId: 'home', name: '家用电脑', online: true, platform: 'macos' },
  { deviceId: 'offline', name: '离线电脑', online: false, platform: 'windows' },
];

function Harness() {
  const desktop = useDesktopLayout();
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState('work');
  const [refreshes, setRefreshes] = useState(0);
  const device = devices.find(entry => entry.deviceId === deviceId);
  const refresh = () => setRefreshes(value => value + 1);
  const remote = new URLSearchParams(location.search).has('remote');
  const accountPicker = remote ? <RemoteAccountPicker client={client} ready active={open} privacyMode={false}
    computers={{ current: device ?? null, devices, authenticated: true, loading: false, error: '',
      refresh, choose: selected => setDeviceId(selected?.deviceId ?? 'local'), login: () => {} }} />
    : <ChatDesktopAccountPicker client={client} ready active={open} device={device} devices={devices}
      chooseDevice={setDeviceId} deviceRefresh={{ loading: false, error: '', refresh }} />;
  return <main className="chat-page" style={{ height: '100vh' }}>
    <div className="chat-conversation"><header className="chat-header">
      <button onClick={() => setOpen(true)}>打开聊天列表</button><h2>聊天仍可使用</h2>
    </header><output aria-label="当前设备">{deviceId}</output>
      <output aria-label="设备刷新次数">{refreshes}</output></div>
    <ChatSidebar desktop={desktop} open={open} onClose={() => setOpen(false)}>
      <button onClick={() => setOpen(false)}>保留的聊天</button>
      <div className="chat-thread-list" />
      {desktop ? accountPicker : <ChatProfileMenu client={client} ready active={open} guiTools={guiTools}
          running={false} deviceName="测试电脑" email="test@example.test" chooseDevice={() => {}} />}
    </ChatSidebar>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Harness />);
