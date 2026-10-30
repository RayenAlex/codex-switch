import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { AdaptiveSheet } from '../components/AdaptiveSheet';
import { useChatSearch } from '../../../../shared/chat/useChatSearch';
import { ChatSearchResults } from './ChatSearchResults';
import type { ChatController, ChatState, Thread } from './types';

export function ChatSearch({ state, controller, onClose, select }: {
  state: ChatState; controller: ChatController; onClose: () => void; select: (thread: Thread) => void;
}) {
  useLanguage();
  const [query, setQuery] = useState('');
  const search = useChatSearch({ controller, query, archived: state.archived, ready: state.ready });
  return <AdaptiveSheet open title={state.archived ? t("搜索已归档聊天") : t("搜索聊天")} width={680} onClose={onClose}>
    <div className="chat-detail-stack">
      <form className="chat-search chat-row" onSubmit={event => { event.preventDefault(); search.reload(); }}>
        <Search size={18} /><input aria-label={t("搜索聊天")} placeholder={t("搜索聊天")} autoFocus value={query}
          onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" className="chat-back" aria-label={t("清空搜索")} onClick={() => setQuery('')}>
          <X size={16} /></button>}<button type="submit" className="chat-back" aria-label={t("搜索")}
          disabled={!state.ready || search.loading}><Search size={18} /></button>
      </form>
      <div className="chat-search-results chat-scroll">
        <ChatSearchResults state={state} search={search} query={query} select={select} />
      </div>
    </div>
  </AdaptiveSheet>;
}
