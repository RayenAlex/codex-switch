import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatSettings } from '../src/chat/ChatSettings';
import { initialSettings, settingsFixture } from '../../../shared/remote-chat/testing/settingsFixture';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';
import { t } from '../src/i18n';
import '../src/styles.css';
import '../src/chat/chat.css';

setInterfaceLanguage('zh');

function Harness() {
  const [selection, setSelection] = useState(initialSettings);
  const [open, setOpen] = useState(true);
  return <main style={{ minHeight: '100dvh', padding: 20, background: '#f4f4f4' }}>
    <button onClick={() => setOpen(true)}>{t('client.chat.chatSettings.1e06eb')}</button>
    {open && <ChatSettings {...settingsFixture} selection={selection}
      updateSettings={async patch => setSelection(current => ({ ...current, ...patch }))}
      onClose={() => setOpen(false)} />}
  </main>;
}

createRoot(document.getElementById('root')!).render(<Harness />);
