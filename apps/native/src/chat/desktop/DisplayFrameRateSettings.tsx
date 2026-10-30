import { displayError } from '../../i18n/index';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FRAME_RATE_OPTIONS, type DisplaySettingsProps } from '../../../../../shared/remote-desktop/displaySettings';
import { useFrameRateInput } from '../../../../../shared/remote-desktop/useFrameRateInput';
import { t } from '../../i18n';
import { DisplaySettingsHint, DisplaySettingsSection } from './DisplaySettingsSection';
import { useDisplaySettingsStyles as useS } from './displaySettingsStyles';

export function DisplayFrameRateSettings(props: DisplaySettingsProps) {
  const s = useS();
  const { settings, update, saving } = props;
  const input = useFrameRateInput(props);
  return <DisplaySettingsSection icon="pulse" title="client.remoteDesktop.frameRate" description="client.remoteDesktop.higherFrameRatesMakeMotionSmootherAndUseMoreBandwidth">
    <View style={s.options}>
      {FRAME_RATE_OPTIONS.map(fps => <Pressable key={fps} disabled={saving}
        accessibilityRole="radio" accessibilityState={{ checked: settings.fps === fps, disabled: saving }}
        style={[s.choice, settings.fps === fps && s.selected, saving && s.disabled]}
        onPress={() => { void update({ ...settings, fps }); }}>
        <Text style={s.choiceText}>{fps === 'auto' ? t("client.mobile.auto") : t("client.mobile.frames", { value1: fps })}</Text>
      </Pressable>)}
    </View>
    <View style={s.custom}>
      <TextInput disableFullscreenUI style={s.input} value={input.custom} onChangeText={input.edit}
        keyboardType="number-pad" maxLength={3} accessibilityLabel={t("client.remoteDesktop.customFrameRate")}
        onSubmitEditing={() => { if (!saving) input.apply(); }} />
      <Text style={s.description}>{t("client.remoteDesktop.fps")}</Text>
      <Pressable style={[s.apply, saving && s.disabled]} onPress={input.apply} disabled={saving}
        accessibilityRole="button" accessibilityLabel={t("client.remoteDesktop.applyFrameRate")} accessibilityState={{ disabled: saving }}>
        <Text style={s.choiceText}>{t("client.chat.apply")}</Text></Pressable>
    </View>
    {input.error ? <Text accessibilityRole="alert" style={s.error}>{displayError(input.error)}</Text>
      : <DisplaySettingsHint>{t("client.remoteDesktop.choose1144FpsActualPerformanceDependsOnYourNetwork")}</DisplaySettingsHint>}
  </DisplaySettingsSection>;
}
