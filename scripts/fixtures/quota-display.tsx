import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { PetDockSettingsCard } from '../../apps/desktop/src/pages/settings/PetDockSettingsCard';
import { FloatingUsageBubble } from '../../apps/desktop/src/components/FloatingUsageBubble';
import { translate, type Language } from '../../apps/desktop/src/i18n';
import type { Translate } from '../../apps/desktop/src/i18n';
import styles from '../../apps/desktop/src/pages/SettingsPage/index.module.less';

function Fixture() {
  const [language, setLanguage] = useState<Language>('zh');
  const t: Translate = (key, params) => translate(language, key, params);
  return <ConfigProvider><main className={styles.styleScope}>
    <select aria-label="Language" value={language} onChange={event => setLanguage(event.target.value as Language)}>
      {['zh', 'en', 'ru', 'ja'].map(value => <option key={value}>{value}</option>)}
    </select>
    <PetDockSettingsCard t={t} />
    <FloatingUsageBubble />
  </main></ConfigProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
