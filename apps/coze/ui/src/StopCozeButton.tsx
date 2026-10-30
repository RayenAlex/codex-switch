import { useEffect, useState } from "react";
import { Popconfirm } from "antd";
import { Power } from "lucide-react";
import {
  COZE_DESKTOP_READY, COZE_DESKTOP_STOP, COZE_DESKTOP_STOP_READY, isCozeDesktopState,
} from "../../../../shared/coze/desktopBridge";
import { useT } from "./i18n";

export function StopCozeButton() {
  const t = useT();
  const [desktop, setDesktop] = useState<{ origin: string; busy: boolean }>();
  useEffect(() => {
    if (window.parent === window) return;
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent || !isCozeDesktopState(event.data)) return;
      setDesktop({ origin: event.origin, busy: event.data.busy });
    };
    window.addEventListener("message", receive);
    // The desktop origin varies between development and packaged apps; this handshake carries no private data.
    window.parent.postMessage(COZE_DESKTOP_READY, "*");
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    // Acknowledge only after the host state has made the sidebar control visible.
    if (desktop) window.parent.postMessage(COZE_DESKTOP_STOP_READY, desktop.origin);
  }, [desktop]);
  if (!desktop) return null;
  return <Popconfirm title={t("coze.core.stopCozeYourSavedContentWillBeKept")} placement="topLeft"
    okText={t("coze.core.stop")} cancelText={t("coze.core.cancel")} disabled={desktop.busy} styles={{ root: { maxWidth: 400 } }}
    onConfirm={() => window.parent.postMessage(COZE_DESKTOP_STOP, desktop.origin)}>
    <button type="button" className="studio-nav-button" aria-label={t("coze.core.stopCoze")}
      disabled={desktop.busy} aria-busy={desktop.busy}>
      <Power size={18} /><span>{desktop.busy ? t("coze.core.stopping") : t("coze.core.stopCoze")}</span>
    </button>
  </Popconfirm>;
}
