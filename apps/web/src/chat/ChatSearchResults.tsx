import { MessageSquare } from 'lucide-react';
import { t, useLanguage } from '../i18n';
import type { useChatSearch } from '../../../../shared/chat/useChatSearch';
import { threadPresentation } from '../../../../shared/remote-chat/sidebar';
import type { ChatState, Thread } from './types';

export function ChatSearchResults({ state, search, query, select }: {
  state: ChatState; search: ReturnType<typeof useChatSearch>; query: string; select: (thread: Thread) => void;
}) {
  useLanguage();
  const emptyMessage = !state.ready ? t('连接电脑后即可搜索聊天')
    : query.trim() ? t('没有找到相关聊天') : t('输入关键词，查找聊天');
  return <>
    {search.threads.map(thread => {
      const view = threadPresentation(thread, state.sidebar, t);
      return <button key={thread.id} type="button" className="chat-thread" aria-label={view.title}
        aria-current={state.selected?.id === thread.id ? 'page' : undefined}
        disabled={!state.ready || state.sending} onClick={() => select(thread)}><MessageSquare size={20} />
        <span className="chat-grow"><span className="chat-ellipsis">{view.title}</span>
          <small className="chat-muted">{view.projectName}</small></span></button>;
    })}
    {!search.loading && !search.error && !search.threads.length && <p className="chat-empty chat-muted">
      {emptyMessage}</p>}
    {search.loading && <p role="status" className="chat-muted">{t('正在搜索…')}</p>}
    {search.error && <><p role="alert" className="chat-error">{t(search.error)}</p>
      <button type="button" className="chat-button" onClick={search.reload}>{t('重试')}</button></>}
    {search.cursor && !search.loading && !search.error && <button type="button" className="chat-button"
      disabled={!state.ready} onClick={search.loadMore}>{t('加载更多')}</button>}
  </>;
}
