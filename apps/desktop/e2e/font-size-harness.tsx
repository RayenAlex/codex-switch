import { createRoot } from 'react-dom/client';
import { ApplicationTypography } from '../../../shared/appearance/ApplicationTypography';
import { GlobalFontSettingsCard } from '../src/pages/settings/GlobalFontSettingsCard';
import { GlobalFontSettings } from '../../../shared/appearance/GlobalFontSettings';
import { GuiAppearanceSettings } from '../src/pages/codexGui/GuiAppearanceSettings';
import { GuiFontSettingsButton } from '../src/pages/codexGui/GuiFontSettingsButton';
import { DetailsWorkspace } from '../src/pages/codexGui/DetailsWorkspace';
import { ChatDetailsWorkspace } from '../../web/src/chat/ChatDetailsWorkspace';
import { Messages } from '../src/pages/codexGui/Messages';
import { ChatMessages } from '../../web/src/chat/ChatMessages';
import { conversation } from '../src/pages/codexGui/events';
import type { Thread } from '../src/pages/codexGui/types';
import { uiText, setGuiLanguage } from '../src/i18n/uiText';
import { setLanguage, useLanguage } from '../../web/src/i18n';
import { WebLocaleProvider } from '../../web/src/i18n/WebLocaleProvider';
import { Button } from 'antd';
import styles from '../src/pages/codexGui/styles.module.less';
import 'antd/dist/reset.css';
import '../../web/src/styles.css';
import '../../web/src/chat/chat.css';
import '../../web/src/chat/composer.css';
import '../src/pages/codexGui/remote/remoteGui.less';
import './font-size-harness.css';

const mode = new URLSearchParams(location.search).get('mode') ?? 'local';
if (mode !== 'web') void import('../src/pages/SettingsPage/index.module.less');
const thread: Thread = { id: 'font-thread', cwd: '', preview: '', updatedAt: 1, turns: [{
  id: 'turn', status: 'completed', items: [
    { id: 'question', type: 'userMessage', text: '请检查页面的字号。' },
    { id: 'reply', type: 'agentMessage', text: '正文应清晰易读，字号调整后立即生效。\n\n`const fontSize = 18;`' },
  ],
}] };

function Harness() {
  useLanguage();
  return <ApplicationTypography><WebLocaleProvider><main className="font-harness">
    <header className="font-harness-global">
      {mode === 'web' ? <GlobalFontSettings t={uiText} /> : <GlobalFontSettingsCard />}
      <div className="font-harness-actions"><Button>常用控件</Button>
        <button onClick={() => { setGuiLanguage('en'); setLanguage('en'); }}>English</button>
        <button onClick={() => { setGuiLanguage('zh'); setLanguage('zh'); }}>中文</button>
        {mode !== 'local' && <GuiFontSettingsButton active />}</div>
    </header>
    <aside className="font-harness-settings"><GuiAppearanceSettings /></aside>
    <section className="font-harness-conversation" data-testid="conversation">
      {mode === 'local' ? <DetailsWorkspace selected={thread.id} active>
        <div className={`${styles.page} ${styles.collapsed}`}>
          <div className={styles.workspace}><Messages selected={thread.id} value={conversation(thread)} /></div>
        </div>
      </DetailsWorkspace> : <div className={`chat-page ${mode === 'remote' ? 'gui-remote-workspace' : ''}`}>
        <ChatDetailsWorkspace selected={thread.id} active enabled>
          <div className="chat-conversation"><ChatMessages thread={thread} desktop />
            <div className="chat-composer"><textarea aria-label="聊天消息" defaultValue="字号预览" /></div>
          </div>
        </ChatDetailsWorkspace>
      </div>}
    </section>
  </main></WebLocaleProvider></ApplicationTypography>;
}

createRoot(document.getElementById('root')!).render(<Harness />);
