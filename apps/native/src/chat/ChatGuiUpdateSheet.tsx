import { SheetGestureScrollView as ScrollView } from '../components/SheetScrollGesture';
import { displayError } from '../i18n/index';
import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import { Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SHEET_READABLE_WIDTH } from '../components/SheetScrollView';
import { useGuiUpdate, type GuiUpdateOptions } from '../../../../shared/remote-chat/useGuiUpdate';
import { useStyles } from './styles';

export function ChatGuiUpdateSheet({ deviceName, onClose, onBack, ...options }: GuiUpdateOptions & {
  deviceName?: string; onClose: () => void; onBack: () => void;
}) {
  const localStyles = useLocalStyles();
  const styles = useStyles();
  useLanguage();
  const update = useGuiUpdate(options);
  return <BottomSheet visible title={update.confirmation ? t("client.app.installCodexGuiUpdate") : t("client.app.updateCodexGui")}
    subtitle={deviceName || t("client.app.currentComputer")} onClose={onClose} onBack={update.confirmation ? update.cancel : onBack}
    maxWidth={SHEET_READABLE_WIDTH} actions={update.confirmation ? [
      { label: t("client.settings.notNow"), onPress: update.cancel },
      { label: t("client.app.confirmInstallation"), tone: 'primary', disabled: !update.canConfirm, onPress: update.confirm },
    ] : [
      { label: displayError(update.checkLabel), disabled: !update.canCheck, onPress: update.check },
      { label: t("client.settings.installUpdate"), tone: 'primary', disabled: !update.canInstall, onPress: update.requestInstall },
    ]}>
    <ScrollView><View style={localStyles.body}>
      {update.confirmation ? <>
        <Text style={styles.title}>v{update.confirmation}</Text>
        <Text style={styles.subtitle}>{t("client.app.codexGuiWillUpdateOnThisComputerAndReconnectAutomatically")}</Text>
      </> : <>
        <Text style={styles.subtitle}>{t("client.settings.version")}</Text>
        <Text selectable style={styles.title}>{update.version ? `v${update.version}` : t("client.settings.versionUnavailable")}</Text>
        {update.available && update.release && <>
          <Text style={styles.subtitle}>{t("client.settings.availableVersion")}</Text>
          <Text selectable style={styles.title}>v{update.release.version}</Text>
        </>}
      </>}
      <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{displayError(update.message)}</Text>
      {update.progress !== null && <Text accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: update.progress }} style={styles.title}>{update.progress}%</Text>}
      {!!update.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(update.error)}</Text>}
    </View></ScrollView>
  </BottomSheet>;
}

const useLocalStyles = createThemedStyles(() => ({
  body: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 12, paddingBottom: 16 },
}));
