import { Alert } from "antd";
import { uiText } from "../../i18n/uiText";
import type { GuiState } from "./types";
import styles from "./styles.module.less";

export function GuiSetupAlerts({ computerUseSetup, unattendedSetup }:
  Pick<GuiState, "computerUseSetup" | "unattendedSetup">) {
  return <>
    {computerUseSetup === "installing" && <Alert className={styles.error} type="info" showIcon
      message={<span style={{ display: "block", maxWidth: 400 }}>
        {uiText("client.workspaceSettings.installingTheComputerAssistantInitialSetupMayTakeAFew")}</span>} />}
    {computerUseSetup === "failed" && <Alert className={styles.error} type="warning" showIcon closable
      message={<span style={{ display: "block", maxWidth: 400 }}>
        {uiText("client.workspaceSettings.theComputerAssistantCouldNotFinishInstallingYouCanKeep")}</span>} />}
    {unattendedSetup === "installing" && <Alert className={styles.error} type="info" showIcon
      message={<span style={{ display: "block", maxWidth: 400 }}>
        {uiText("client.remoteDesktop.enablingUnattendedAccessApproveTheAdministratorPromptWhenItAppears")}</span>} />}
    {unattendedSetup === "failed" && <Alert className={styles.error} type="warning" showIcon closable
      message={<span style={{ display: "block", maxWidth: 400 }}>
        {uiText("client.remoteDesktop.unattendedAccessCouldNotBeEnabledYouCanKeepChatting")}</span>} />}
  </>;
}
