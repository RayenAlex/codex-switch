import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { LoungeUserModal } from '../../admin-ui/src/pages/LoungeUserModal';
import { LoungePresence } from '../../admin-ui/src/pages/LoungePresence';
import { I18nProvider } from '../../admin-ui/src/i18n-context';
import type { LoungePolicy } from '../../../shared/lounge/types';
import 'antd/dist/reset.css';

window.loungeAdminFixture = { writes: [] as unknown[], closed: false };
declare global { interface Window { loungeAdminFixture: { writes: unknown[]; closed: boolean } } }
const policy: LoungePolicy = { moderator: false, mutedUntil: null };
const api = async <T,>(_path: string, init?: RequestInit): Promise<T> => {
  if (_path.endsWith('/presence')) return { onlineCount: 7 } as T;
  if (init?.body) window.loungeAdminFixture.writes.push(JSON.parse(String(init.body)));
  return policy as T;
};
function Fixture() {
  const [open, setOpen] = useState(true);
  return <I18nProvider language="zh" onLanguageChange={() => {}}>
    <LoungePresence api={api} />
    {open && <LoungeUserModal user={{ id: 'bob', email: 'bob@example.test', disabled: false, role: 'user' }}
      self={false} api={api} close={() => { setOpen(false); window.loungeAdminFixture.closed = true; }} />}
  </I18nProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
