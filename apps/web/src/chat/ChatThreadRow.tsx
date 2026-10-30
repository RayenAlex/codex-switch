import { LoaderCircle, MoreHorizontal } from 'lucide-react';
import { threadPresentation } from '../../../../shared/remote-chat/sidebar';
import type { ChatState, Thread } from './types';
import { useThreadLongPress } from '../../../../shared/chat/useThreadLongPress';
import type { ThreadActionsModel } from '../../../../shared/remote-chat/client/useThreadActions';
import { useDesktopLayout } from '../useDesktopLayout';
import { ChatThreadContextMenu } from './ChatThreadContextMenu';
import { t } from '../i18n';
import './thread-actions.css';

export function ChatThreadRow({ thread, state, select, actions }: {
  thread: Thread; state: ChatState; select: () => void; actions: ThreadActionsModel;
}) {
  const desktop = useDesktopLayout();
  const view = threadPresentation(thread, state.sidebar, t);
  const openActions = () => actions.open(thread);
  const gestures = useThreadLongPress(openActions, { enabled: !desktop });
  const disabled = !state.ready || state.sending;
  const row = <div className="chat-thread-row">
    <button type="button" className="chat-thread" aria-label={view.title} {...(!desktop ? gestures : {})}
      aria-haspopup={desktop ? 'menu' : 'dialog'}
      aria-current={state.selected?.id === thread.id ? 'page' : undefined} disabled={disabled} onClick={select}>
      <span className="chat-grow chat-ellipsis">{view.title}</span>
      <span className="chat-thread-status">{view.running
        ? <LoaderCircle size={14} className="chat-spinner" aria-label={t('正在回复')} />
        : view.unread && <span className="chat-unread-dot" aria-label={t('未读回复')} />}</span>
    </button>
    {!desktop && <button type="button" className="chat-thread-more" aria-label={t('管理对话：{name}', { name: view.title })}
      aria-haspopup="dialog" disabled={disabled} onClick={openActions}><MoreHorizontal size={18} /></button>}
  </div>;
  return desktop ? <ChatThreadContextMenu thread={thread} state={state} actions={actions}>{row}</ChatThreadContextMenu>
    : row;
}
