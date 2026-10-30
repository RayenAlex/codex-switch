import { MoreHorizontal, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ProjectBrowserClient } from './protocol';
import { useProjectTree, type DirectoryState } from './useProjectTree';
import { normalizedPath, parentPath, type BrowserHost } from './entryActions';
import type { ProjectDocuments } from './documents';
import { ProjectTreeRow } from './ProjectTreeRow';
import { useTreeActions } from './useTreeActions';
import { useTreeGesture } from './useTreeGesture';
import { TreeMenu } from './TreeMenu';
import { TreeActionDialog } from './TreeActionDialog';
import { useProjectTreeSearch } from './useProjectTreeSearch';
import { ProjectTreeSearch, ProjectTreeSearchNotice } from './ProjectTreeSearch';

export type BrowserTranslate = (source: string) => string;

function DirectoryNotice({ state, retry, t }: {
  state?: DirectoryState; retry: () => void; t: BrowserTranslate;
}) {
  if (state?.loading) return <p className="pf-notice" role="status">{t('正在加载…')}</p>;
  if (state?.error) return <div className="pf-notice" role="alert">{t(state.error)}
    <button type="button" onClick={retry}>{t('重试')}</button></div>;
  if (state?.data?.truncated) return <p className="pf-notice">{t('文件较多，仅显示前 500 项。')}</p>;
  if (state?.data && !state.data.entries.length) return <p className="pf-notice">{t('文件夹为空')}</p>;
  return null;
}

export function ProjectTree({ client, cwd, connected, selected, choose, t, host, documents }: {
  client: ProjectBrowserClient; cwd: string; connected: boolean; selected?: string;
  choose: (path: string) => void; t: BrowserTranslate;
  host: BrowserHost; documents: ProjectDocuments;
}) {
  const tree = useProjectTree(client, cwd, connected);
  const search = useProjectTreeSearch(client, cwd, connected);
  const list = useRef<HTMLDivElement>(null);
  const [revealPath, setRevealPath] = useState('');
  const actions = useTreeActions({ cwd, connected, host, documents, choose });
  useEffect(() => documents.subscribeEntries(({ request, path }) => {
    search.refresh();
    const change = ['rename', 'move', 'delete'].includes(request.action)
      ? { from: request.path, to: path, deleted: request.action === 'delete' } : undefined;
    return tree.reload(request.action === 'createFolder' ? request.path : parentPath(path), change);
  }), [documents, tree.reload, search.refresh]);
  useEffect(() => {
    if (!revealPath || search.active) return;
    const row = [...(list.current?.querySelectorAll<HTMLButtonElement>('.pf-tree-row') ?? [])]
      .find(row => row.dataset.path === revealPath);
    if (row) { row.focus(); row.scrollIntoView({ block: 'nearest' }); setRevealPath(''); }
  }, [revealPath, search.active, tree.rows]);
  const rows = search.active ? search.entries.map(entry => ({ entry, depth: 0 })) : tree.rows;
  const root = { path: cwd, name: cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? cwd, directory: true };
  const rootGesture = useTreeGesture(position => actions.show({ entry: root, ...position }));
  return <nav className="pf-tree" aria-label={t('项目文件')}>
    <div className="pf-tree-heading"><span {...rootGesture}>{root.name}</span>
      <button type="button" aria-label={t('项目文件夹操作')} disabled={!connected || actions.busy}
        onClick={event => { const rect = event.currentTarget.getBoundingClientRect();
          actions.show({ entry: root, x: rect.left, y: rect.bottom }); }}><MoreHorizontal size={16} /></button>
      <button type="button" aria-label={t('刷新文件树')} disabled={!connected}
        onClick={() => { tree.refresh(); search.refresh(); }}><RefreshCw size={16} /></button></div>
    <ProjectTreeSearch query={search.query} disabled={!connected} t={t}
      change={value => { actions.close(); search.change(value); }} />
    <div ref={list} role="tree" aria-label={t('项目文件')} className="pf-tree-list" aria-busy={search.loading}>
      {rows.map(({ entry, depth }) => {
        const expanded = !search.active && tree.expanded.has(entry.path);
        return <div key={entry.path} role="none"
          style={{ '--pf-tree-row-indent': `${10 + depth * 16}px` } as CSSProperties}>
          <ProjectTreeRow entry={entry} depth={depth} expanded={expanded} selected={selected === entry.path}
            relativePath={search.active ? entry.relativePath
              ?? normalizedPath(entry.path).slice(normalizedPath(cwd).length + 1) : undefined}
            disabled={!connected || actions.busy} cut={!!actions.clipboard?.cut
              && actions.clipboard.entry.path === entry.path}
            open={() => {
              if (!entry.directory) { choose(entry.path); return; }
              if (!search.active) { tree.toggle(entry); return; }
              search.change(''); void tree.reveal(entry.path); setRevealPath(entry.path);
            }}
            menu={actions.show} command={actions.command} />
          {entry.directory && expanded && <DirectoryNotice state={tree.directories[entry.path]}
            retry={() => void tree.load(entry.path)} t={t} />}
        </div>;
      })}
      {search.active ? connected && <ProjectTreeSearchNotice search={search} t={t} />
        : <DirectoryNotice state={tree.directories['']} retry={() => void tree.load('')} t={t} />}
    </div>
    {actions.message && <p role="status" className="pf-notice">{t(actions.message)}</p>}
    {actions.error && !actions.prompt && <p role="alert" className="pf-notice">{t(actions.error)}</p>}
    {actions.menu && <TreeMenu menu={actions.menu} cwd={cwd} host={host}
      canPaste={!!actions.clipboard} close={actions.close} t={t}
      command={command => actions.command(actions.menu!.entry, command)} />}
    {actions.prompt && <TreeActionDialog key={`${actions.prompt.action}:${actions.prompt.entry.path}`}
      prompt={actions.prompt} busy={actions.busy} connected={connected} error={actions.error}
      confirm={name => { void actions.confirm(name); }} cancel={actions.cancel} t={t} />}
  </nav>;
}
