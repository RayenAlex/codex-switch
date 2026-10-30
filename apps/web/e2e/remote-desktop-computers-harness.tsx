import { useState } from 'react';
import { createGuiToolsClient } from '../../../shared/remote-chat/guiTools';
import { RemoteDesktopHost } from '../../desktop/src/remoteDesktop/host';
import { GuiRemoteDesktop } from '../../desktop/src/pages/codexGui/GuiRemoteDesktop';
import { ChatTools } from '../src/chat/ChatTools';

const computers = ['office', 'home'].map(id => {
  const host = new RemoteDesktopHost();
  host.register(id, []);
  window.addEventListener('beforeunload', () => host.release());
  const client = createGuiToolsClient(<T,>(body: object) => host.request(body, id) as Promise<T>);
  return { id, client };
});

/** Independent hosts use the existing native capture fixture and real WebRTC sessions. */
export function RemoteDesktopComputersHarness() {
  const native = new URLSearchParams(location.search).has('native-clipboard');
  const [selected, select] = useState<string | null>('office');
  const [signedIn, setSignedIn] = useState(true);
  return <main style={{ padding: 24 }}>
    <nav>
      {computers.map(({ id }) => <button key={id} id={`select-${id}`} onClick={() => select(id)}>{id}</button>)}
      <button id="select-local" onClick={() => select(null)}>Local</button>
      <button id="sign-out" onClick={() => setSignedIn(false)}>Sign out</button>
    </nav>
    {signedIn && computers.map(({ id, client }) => {
      const active = selected === id;
      const launcher = <GuiRemoteDesktop client={client.desktop} active={active} connected />;
      return <section key={id} hidden={!active} data-computer={id}>
        <header className="chat-header">
          {native ? launcher : <ChatTools client={client} cwd="C:/workspace" active={active}
            connected desktopActions={launcher} />}
        </header>
      </section>;
    })}
    <input aria-label="本机聊天消息" />
  </main>;
}
