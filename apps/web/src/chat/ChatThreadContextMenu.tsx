import type { ReactElement, HTMLAttributes } from 'react';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import { ThreadContextMenu } from '../../../../shared/chat/ThreadContextMenu';
import { threadActionReason } from '../../../../shared/remote-chat/client/threadActions';
import type { ThreadActionsModel } from '../../../../shared/remote-chat/client/useThreadActions';
import type { ChatState, Thread } from './types';
import { t } from '../i18n';

export function ChatThreadContextMenu({ thread, state, actions, children }: {
  thread: Thread; state: ChatState; actions: ThreadActionsModel;
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}) {
  const current = actions.target?.thread.id === thread.id && actions.view === 'menu';
  const archive = state.archived ? 'unarchive' : 'archive';
  const reason = (action: 'rename' | 'delete' | typeof archive) => threadActionReason(state, thread, action);
  const hint = (current && actions.error) || reason(archive);
  const items = [
    { key: 'rename', label: t('重命名对话'), icon: <Pencil size={16} />, disabled: !!reason('rename') },
    { key: archive, label: t(state.archived ? '恢复' : '归档'), disabled: !!reason(archive),
      icon: state.archived ? <ArchiveRestore size={16} /> : <Archive size={16} /> },
    { key: 'delete', label: t('删除对话'), icon: <Trash2 size={16} />, danger: true, disabled: !!reason('delete') },
    ...(hint ? [{ key: 'hint', disabled: true, label: <span role="alert">{t(hint)}</span> }] : []),
  ];
  return <ThreadContextMenu open={current} disabled={!state.ready || state.sending}
    onOpenChange={(open, info) => {
      if (info.source === 'menu') return;
      if (open) actions.open(thread); else actions.close();
    }} menu={{ items, onClick: ({ key }) => {
      if (key === 'rename' || key === 'delete') actions.changeView(key);
      if (key === archive) void actions.submit(archive);
    } }}>{children}</ThreadContextMenu>;
}
