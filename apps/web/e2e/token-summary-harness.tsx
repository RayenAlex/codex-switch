import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatTokenSummary } from '../src/chat/ChatTokenSummary';
import type { TokenSummary } from '../../../shared/remote-chat/tokenSummary';
import '../src/styles.css';
import '../src/chat/chat.css';

const read = async (weeks = 2): Promise<TokenSummary> => {
  const response = await fetch(`/web/token-summary-fixture.json?weeks=${weeks}`);
  if (!response.ok) throw new Error('Fixture offline');
  return response.json();
};

function Harness() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(true);
  return <>
    <button onClick={() => setOpen(true)}>Open summary</button>
    <button onClick={() => setReady(false)}>Offline</button>
    {open && <ChatTokenSummary read={read} ready={ready} scope="summary-fixture" deviceName="测试电脑"
      onClose={() => setOpen(false)} />}
  </>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
