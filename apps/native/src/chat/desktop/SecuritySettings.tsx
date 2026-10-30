import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { SecuritySettingsProps } from '../../../../../shared/remote-desktop/security';
import { t, useLanguage } from '../../i18n';
import { createThemedStyles } from '../../theme/styles';
import { useDisplaySettingsStyles } from './displaySettingsStyles';
import { AutoUnlockSettings } from './AutoUnlockSettings';

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;
interface ClipboardActions { busy: boolean; status: string; copy: () => void; paste: () => void }

function Toggle({ icon, title, description, checked, disabled, change }: {
  icon: Icon; title: string; description: string; checked: boolean; disabled: boolean; change: () => void;
}) {
  const s = useStyles();
  return <Pressable accessibilityRole="switch" accessibilityLabel={t(title)}
    accessibilityState={{ checked, disabled }} disabled={disabled} onPress={change}
    style={[s.option, disabled && s.disabled]}>
    <MaterialCommunityIcons name={icon} size={23} color="#a8c8ff" />
    <View style={s.copy}><Text style={s.title}>{t(title)}</Text>
      <Text style={s.description}>{t(description)}</Text></View>
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
  return <View style={panel.panel} accessibilityLabel={t('安全选项')}>
    <View style={panel.header}>
      <MaterialCommunityIcons name="shield-check-outline" size={26} color="#a8c8ff" />
      <Text style={[panel.title, panel.headerCopy]}>{t('安全选项')}</Text>
      <Pressable style={panel.close} onPress={close} accessibilityRole="button" accessibilityLabel={t('关闭安全选项')}>
        <MaterialCommunityIcons name="close" size={22} color="#aab6c9" /></Pressable>
    </View>
    <ScrollView style={panel.scroll} contentContainerStyle={panel.content} keyboardShouldPersistTaps="handled"
      nestedScrollEnabled accessibilityLabel={t('安全设置选项')}>
      {notice && <View><Text style={s.description} accessibilityRole="alert">{t(notice.message)}</Text>
        <Pressable accessibilityRole="button" disabled={saving} onPress={notice.run} style={s.choice}>
          <Text style={s.text}>{t(notice.label)}</Text></Pressable></View>}
      <AutoUnlockSettings {...props} />
      <Toggle icon="lock-outline" title="远程结束后锁屏" checked={value.lockOnDisconnect}
        disabled={disabled || !supported} change={() => { void update({ lockOnDisconnect: !value.lockOnDisconnect }); }}
        description={supported ? '连接结束或断开后，自动锁定远程电脑。' : '这台电脑暂不支持此安全选项。'} />
      <Toggle icon="volume-off" title="被控端静音运行" checked={value.muteHost}
        disabled={disabled || !supported} change={() => { void update({ muteHost: !value.muteHost }); }}
        description={supported ? '远程电脑静音，本机仍可听到声音；连接结束后恢复。' : '这台电脑暂不支持此安全选项。'} />
      <View style={s.section} accessibilityLabel={t('被控端防窥模式')}>
        <View style={s.heading}><MaterialCommunityIcons name="eye-off-outline" size={23} color="#a8c8ff" />
          <View style={s.copy}><Text style={s.title}>{t('被控端防窥模式')}</Text>
            <Text style={s.description}>{t(privacy.available
              ? '隐藏远程电脑的屏幕内容，本机仍可查看和操作。' : '这台电脑暂不支持隐私屏。')}</Text></View></View>
        <View style={s.choices}>{[false, true].map(enabled => <Pressable key={String(enabled)}
          accessibilityRole="radio" accessibilityLabel={t(enabled ? '启用' : '不启用')}
          accessibilityState={{ checked: privacy.enabled === enabled, disabled: disabled || !privacy.available }}
          disabled={disabled || !privacy.available} onPress={() => {
            if (privacy.enabled !== enabled) void privacy.toggle();
          }} style={[s.choice, privacy.enabled === enabled && s.selected,
            (disabled || !privacy.available) && s.disabled]}>
          <Text style={s.text}>{t(enabled ? '启用' : '不启用')}</Text></Pressable>)}</View>
      </View>
      <Toggle icon="content-copy" title="同步剪贴板" checked={clipboard.enabled}
        disabled={!connected || !clipboard.available} change={clipboard.toggle}
        description="开启后，可在本机和远程电脑之间复制粘贴。" />
      {clipboard.enabled && <View style={s.choices}>
        {[{ label: '复制到本机', run: clipboardActions.copy }, { label: '粘贴到远程电脑', run: clipboardActions.paste }]
          .map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={t(item.label)}
            disabled={!connected || !clipboard.available || clipboardActions.busy}
            onPress={item.run} style={s.choice}><Text style={s.text}>{t(item.label)}</Text></Pressable>)}
      </View>}
      {!!clipboardActions.status && <Text style={s.description} accessibilityRole="alert">
        {t(clipboardActions.status)}</Text>}
      {!!error && <Text style={panel.error} accessibilityRole="alert">{t(error)}</Text>}
      {!control && <Text style={s.description}>{t('仅观看')}</Text>}
    </ScrollView>
  </View>;
}

const useStyles = createThemedStyles(() => ({
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
