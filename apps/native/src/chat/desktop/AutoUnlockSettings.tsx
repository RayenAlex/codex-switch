import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { autoUnlockDescription, type SecuritySettingsProps } from '../../../../../shared/remote-desktop/security';
import { useAutoUnlockForm } from '../../../../../shared/remote-desktop/useAutoUnlockForm';
import { t } from '../../i18n';
import { createThemedStyles } from '../../theme/styles';

export function AutoUnlockSettings(props: SecuritySettingsProps) {
  const form = useAutoUnlockForm(props);
  const s = useStyles();
  const state = props.value.autoUnlock;
  const disabled = !props.connected || !props.control || !props.supported || props.saving || !state;
  return <View>
    <Pressable accessibilityRole="switch" accessibilityLabel={t('自动解锁被控端')}
      accessibilityState={{ checked: state?.enabled ?? false, disabled }} disabled={disabled}
      onPress={form.toggle} style={[s.option, disabled && s.disabled]}>
      <MaterialCommunityIcons name="lock-open-outline" size={23} color="#a8c8ff" />
      <View style={s.copy}><Text style={s.title}>{t('自动解锁被控端')}</Text>
        <Text style={s.hint} accessibilityLiveRegion="polite">{t(autoUnlockDescription(state))}</Text></View>
      <View style={[s.track, state?.enabled && s.trackOn]}>
        <View style={[s.thumb, state?.enabled && s.thumbOn]} /></View>
    </Pressable>
    {state?.enabled && !form.editing && <Pressable accessibilityRole="button"
      accessibilityLabel={t('修改登录信息')} disabled={disabled} onPress={form.edit} style={s.button}>
      <Text style={s.text}>{t('修改登录信息')}</Text></Pressable>}
    {form.editing && <View style={s.form}>
      <Text style={s.title}>{t('Windows 账号')}</Text>
      <TextInput accessibilityLabel={t('Windows 账号')} value={form.username} onChangeText={form.setUsername}
        autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none"
        importantForAutofill="noExcludeDescendants" maxLength={256} editable={!disabled} style={s.input}
        placeholder={t('例如：电脑名\\用户名')} placeholderTextColor="#aab6c9" />
      <Text style={s.title}>{t('Windows 登录密码')}</Text>
      <TextInput accessibilityLabel={t('Windows 登录密码')} value={form.password} onChangeText={form.setPassword}
        secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none"
        importantForAutofill="noExcludeDescendants" maxLength={256} editable={!disabled} style={s.input} />
      <Text style={s.hint}>{t('请填写账号密码，不是 PIN。密码仅加密保存在远程电脑；关闭后会删除。')}</Text>
      <View style={s.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('取消')} onPress={form.cancel} style={s.button}>
          <Text style={s.text}>{t('取消')}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('保存并启用')}
          disabled={disabled || !form.username.trim() || !form.password} onPress={form.save} style={s.button}>
          <Text style={s.text}>{t('保存并启用')}</Text></Pressable>
      </View>
    </View>}
  </View>;
}

const useStyles = createThemedStyles(() => ({
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12,
    backgroundColor: '#ffffff07', borderWidth: 1, borderColor: '#394354', borderRadius: 12 },
  copy: { flex: 1, minWidth: 0 }, title: { color: '#eef3fc', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  hint: { color: '#aab6c9', fontSize: 12, lineHeight: 19, marginTop: 4 },
  track: { width: 38, height: 22, borderRadius: 12, padding: 3, backgroundColor: '#4d5869' },
  trackOn: { backgroundColor: '#4d8feb' }, thumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#e7edf8' },
  thumbOn: { transform: [{ translateX: 16 }] }, disabled: { opacity: 0.6 },
  form: { gap: 8, paddingVertical: 12 }, actions: { flexDirection: 'row', gap: 8 },
  input: { minWidth: 0, color: '#eef3fc', backgroundColor: '#131b28', fontSize: 16, padding: 10,
    borderWidth: 1, borderColor: '#637086', borderRadius: 8 },
  button: { flexGrow: 1, minHeight: 38, marginTop: 6, padding: 8, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#315686', borderRadius: 8 },
  text: { color: '#eef3fc', fontSize: 13, lineHeight: 20 },
}));
