import { t, useLanguage } from '../i18n';
import { useEffect, type ReactNode } from 'react';
import { Drawer } from 'antd';
import { X } from 'lucide-react';
import { ResizableThreadSidebar } from '../../../../shared/chat/ResizableThreadSidebar';
import './chat-sidebar.less';

export function ChatSidebar({ desktop, open, onClose, children, customHeading = false }: {
  desktop: boolean; open: boolean; onClose: () => void; children: ReactNode;
  customHeading?: boolean;
}) {
  useLanguage();
  useEffect(() => {
    if (desktop || !open) return;
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const element = anchor instanceof Element ? anchor : anchor?.parentElement;
    // A mobile drawer covers the conversation; its hidden text must not retain floating selection controls.
    if (element?.closest('.chat-message-region')) selection?.removeAllRanges();
  }, [desktop, open]);
  if (desktop && !open) return null;
  // The desktop remote workspace supplies its own resizable sidebar.
  if (desktop && customHeading) return <aside className="chat-sidebar" aria-label={t("聊天列表")}>
    {children}
  </aside>;
  if (desktop) return <ResizableThreadSidebar className="chat-sidebar chat-sidebar-resizable"
    layoutSelector=".chat-diff-layout, .chat-page" label={t("聊天列表")} resizeLabel={t("调整聊天列表宽度")}>
    <header className="chat-sidebar-heading"><strong>{t("聊天")}</strong></header>
    {children}
  </ResizableThreadSidebar>;
  return <Drawer open={open} placement="left" width="min(360px, 88vw)" rootClassName="chat-drawer"
    title={t("聊天")} destroyOnClose onClose={onClose} closeIcon={<X size={20} aria-label={t("收起聊天列表")} />}>
    {children}
  </Drawer>;
}
