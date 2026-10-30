import type { ReactNode } from "react";
import { guiText } from "../../i18n/guiText";
import { ResizableThreadSidebar as SharedThreadSidebar } from "../../../../../shared/chat/ResizableThreadSidebar";
import styles from "./styles.module.less";

export function ResizableThreadSidebar({ children, className = "", layoutSelector = `.${styles.page}` }: {
  children: ReactNode; className?: string; layoutSelector?: string;
}) {
  return <SharedThreadSidebar className={`${styles.sidebar} ${className}`} layoutSelector={layoutSelector}
    resizeLabel={guiText("调整聊天列表宽度")}>
    {children}
  </SharedThreadSidebar>;
}
