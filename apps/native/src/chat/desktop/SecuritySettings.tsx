import { displayText, displayError } from '../../i18n/index';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { SecuritySettingsProps } from '../../../../../shared/remote-desktop/security';
import { t, useLanguage } from '../../i18n';
import { createThemedStyles } from '../../theme/styles';
import { useDisplaySettingsStyles } from './displaySettingsStyles';
import { AutoUnlockSettings } from './AutoUnlockSettings';
import { textMetrics } from '../../theme/text';

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;
interface ClipboardActions { busy: boolean; status: string; copy: () => void; paste: () => void }

function Toggle({ icon, title, description, checked, disabled, change }: {
  icon: Icon; title: string; description: string; checked: boolean; disabled: boolean; change: () => void;
}) {
  const s = useStyles();
  return <Pressable accessibilityRole="switch" accessibilityLabel={displayText(title)}
    accessibilityState={{ checked, disabled }} disabled={disabled} onPress={change}
    style={[s.option, disabled && s.disabled]}>
    <MaterialCommunityIcons name={icon} size={23} color="#a8c8ff" />
    <View style={s.copy}><Text style={s.title}>{displayText(title)}</Text>
      <Text style={s.description}>{displayText(description)}</Text></View>
    <View style={[s.track, checked && s.trackOn]}><View style={[s.thumb, checked && s.thumbOn]} /></View>
  </Pressable>;
}

export function SecuritySettings(props: SecuritySettingsProps & { clipboardActions: ClipboardActions }) {
  const s = useStyles();
  const panel = useDisplaySettingsStyles();
  useLanguage();
  const { connected, control, supported, value, saving, error, update, privacy, clipboard, clipboardActions,
    notice, close } = props;
  const disabled = !connected || !control || saving;
  return <View style={panel.panel} accessibilityLabel={t("client.remoteDesktop.security")}>
    <View style={panel.header}>
      <MaterialCommunityIcons name="shield-check-outline" size={26} color="#a8c8ff" />
      <Text style={[panel.title, panel.headerCopy]}>{t("client.remoteDesktop.security")}</Text>
      <Pressable style={panel.close} onPress={close} accessibilityRole="button" accessibilityLabel={t("client.remoteDesktop.closeSecurityOptions")}>
        <MaterialCommunityIcons name="close" size={22} color="#aab6c9" /></Pressable>
    </View>
    {notice && <View style={s.notice}>
      <Text style={s.noticeText} accessibilityRole="alert">{displayError(notice.message)}</Text>
      <Pressable accessibilityRole="button" disabled={saving} onPress={notice.run} style={[s.choice, s.noticeAction]}>
        <Text style={s.noticeActionText}>{displayText(notice.label)}</Text></Pressable></View>}
    <ScrollView style={panel.scroll} contentContainerStyle={panel.content} keyboardShouldPersistTaps="handled"
      nestedScrollEnabled accessibilityLabel={t("client.remoteDesktop.securitySettings")}>
      <AutoUnlockSettings {...props} />
      <Toggle icon="lock-outline" title="client.remoteDesktop.lockWhenDisconnected" checked={value.lockOnDisconnect}
        disabled={disabled || !supported} change={() => { void update({ lockOnDisconnect: !value.lockOnDisconnect }); }}
        description={supported ? "client.remoteDesktop.lockTheRemoteComputerWhenTheConnectionEndsOrIs" : "client.remoteDesktop.thisComputerDoesNotSupportThisSecurityOptionYet"} />
      <Toggle icon="volume-off" title="client.remoteDesktop.muteRemoteSpeakers" checked={value.muteHost}
        disabled={disabled || !supported} change={() => { void update({ muteHost: !value.muteHost }); }}
        description={supported ? "client.remoteDesktop.muteTheRemoteSpeakersWhileKeepingAudioOnThisDevice" : "client.remoteDesktop.thisComputerDoesNotSupportThisSecurityOptionYet"} />
      <View style={s.section} accessibilityLabel={t("client.remoteDesktop.remotePrivacyMode")}>
        <View style={s.heading}><MaterialCommunityIcons name="eye-off-outline" size={23} color="#a8c8ff" />
          <View style={s.copy}><Text style={s.title}>{t("client.remoteDesktop.remotePrivacyMode")}</Text>
            <Text style={s.description}>{t(privacy.available
              ? "client.remoteDesktop.hideTheRemoteComputerSScreenWhileYouContinueTo" : "client.remoteDesktop.privacyScreenIsUnavailableOnThisComputer")}</Text></View></View>
        <View style={s.choices}>{[false, true].map(enabled => <Pressable key={String(enabled)}
          accessibilityRole="radio" accessibilityLabel={t(enabled ? "client.configLabels.enabled" : "client.remoteDesktop.off")}
          accessibilityState={{ checked: privacy.enabled === enabled, disabled: disabled || !privacy.available }}
          disabled={disabled || !privacy.available} onPress={() => {
            if (privacy.enabled !== enabled) void privacy.toggle();
          }} style={[s.choice, privacy.enabled === enabled && s.selected,
            (disabled || !privacy.available) && s.disabled]}>
          <Text style={s.text}>{t(enabled ? "client.configLabels.enabled" : "client.remoteDesktop.off")}</Text></Pressable>)}</View>
      </View>
      <Toggle icon="content-copy" title="client.remoteDesktop.syncClipboard" checked={clipboard.enabled}
        disabled={!connected || !clipboard.available || saving || (!control && value.clipboardSync !== undefined)}
        change={clipboard.toggle}
        description="client.remoteDesktop.copyAndPasteBetweenThisDeviceAndTheRemoteComputer" />
      {clipboard.enabled && <View style={s.choices}>
        {[{ label: "client.remoteDesktop.copyToThisDevice", run: clipboardActions.copy }, { label: "client.remoteDesktop.pasteToRemoteComputer", run: clipboardActions.paste }]
          .map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={displayText(item.label)}
            disabled={!connected || !clipboard.available || clipboardActions.busy}
            onPress={item.run} style={s.choice}><Text style={s.text}>{displayText(item.label)}</Text></Pressable>)}
      </View>}
      {!!clipboardActions.status && <Text style={s.description} accessibilityRole="alert">
        {displayError(clipboardActions.status)}</Text>}
      {!control && <Text style={s.description}>{t("client.remoteDesktop.viewOnly")}</Text>}
    </ScrollView>
    {(error || saving || props.saved) && <View style={s.feedback}>
      {error ? <Text style={panel.error} accessibilityRole="alert">{displayError(error)}</Text>
        : <Text style={s.description} accessibilityLiveRegion="polite">
          {t(saving ? "client.projectBrowser.saving" : "client.remoteDesktop.savedOnTheRemoteComputerTheseSettingsApplyOnYour")}</Text>}
    </View>}
  </View>;
}

const useStyles = createThemedStyles(() => ({
  notice: { flexShrink: 0, maxWidth: 400, paddingHorizontal: 14, paddingBottom: 14, gap: 6 },
  noticeText: { color: '#eef3fc', ...textMetrics(12, 20) },
  noticeAction: { flex: 0, alignSelf: 'flex-start' },
  noticeActionText: { color: '#eef3fc', ...textMetrics(13, 20) },
  feedback: { flexShrink: 0, padding: 10, borderTopWidth: 1, borderTopColor: '#394354' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12,
    backgroundColor: '#ffffff07', borderWidth: 1, borderColor: '#394354', borderRadius: 12 },
  section: { paddingVertical: 14, paddingHorizontal: 12,
    backgroundColor: '#ffffff07', borderWidth: 1, borderColor: '#394354', borderRadius: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: '#eef3fc', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  description: { color: '#aab6c9', fontSize: 12, lineHeight: 19, marginTop: 4 },
  track: { width: 38, height: 22, borderRadius: 12, padding: 3, backgroundColor: '#4d5869' },
  trackOn: { backgroundColor: '#4d8feb' },
  thumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#e7edf8' },
  thumbOn: { transform: [{ translateX: 16 }] },
  choices: { flexDirection: 'row', gap: 8, marginTop: 12 },
  choice: { flex: 1, minHeight: 38, padding: 8, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#ffffff09', borderWidth: 1, borderColor: '#394354', borderRadius: 8 },
  selected: { backgroundColor: '#315686', borderColor: '#589cff' },
  text: { color: '#eef3fc', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  disabled: { opacity: 0.6 },
}));
