import { Search, X } from 'lucide-react';
import { useRef } from 'react';
import { PROJECT_SEARCH_QUERY_LIMIT } from './protocol';
import type { BrowserTranslate } from './ProjectTree';
import type { useProjectTreeSearch } from './useProjectTreeSearch';
import './treeSearch.css';

export function ProjectTreeSearch({ query, disabled, change, t }: {
  query: string; disabled: boolean; change: (value: string) => void; t: BrowserTranslate;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="pf-tree-search" role="search" aria-label={t('搜索文件或文件夹')}>
    <Search size={15} aria-hidden="true" />
    <input ref={input} type="search" value={query} disabled={disabled} maxLength={PROJECT_SEARCH_QUERY_LIMIT}
      placeholder={t('搜索文件或文件夹')} aria-label={t('搜索文件或文件夹')} autoComplete="off" spellCheck={false}
      onChange={event => change(event.target.value)} onKeyDown={event => {
        if (event.key === 'Escape' && query) { event.preventDefault(); event.stopPropagation(); change(''); }
      }} />
    {query && <button type="button" aria-label={t('清空搜索')} onClick={() => { change(''); input.current?.focus(); }}>
      <X size={14} /></button>}
  </div>;
}

export function ProjectTreeSearchNotice({ search, t }: {
  search: ReturnType<typeof useProjectTreeSearch>; t: BrowserTranslate;
}) {
  if (search.loading) return <p className="pf-notice" role="status">{t('正在搜索…')}</p>;
  if (search.failed) return <div className="pf-notice" role="alert">{t('文件搜索失败，请重试。')}
    <button type="button" onClick={search.refresh}>{t('重试')}</button></div>;
  return <>
    {!search.entries.length && <p className="pf-notice" role="status">{t('未找到匹配的文件或文件夹')}</p>}
    {search.truncated && <p className="pf-notice" role="status">{t('仅显示部分结果，请输入更具体的名称。')}</p>}
  </>;
}
