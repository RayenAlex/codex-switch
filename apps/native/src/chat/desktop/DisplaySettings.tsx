import { displayText } from '../../i18n/index';
import { useThemeColor } from '../../theme/store';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MOUSE_INSTRUCTIONS, QUALITY_OPTIONS, type DisplaySettingsProps }
  from '../../../../../shared/remote-desktop/displaySettings';
import { t, useLanguage } from '../../i18n';
import { DisplayFrameRateSettings } from './DisplayFrameRateSettings';
import { DisplayMonitorSettings } from './DisplayMonitorSettings';
import { DisplayResolutionSettings } from './DisplayResolutionSettings';
import { DisplaySettingsHint, DisplaySettingsSection } from './DisplaySettingsSection';
import { useDisplaySettingsStyles as useS } from './displaySettingsStyles';

const COMPACT_PANEL_HEIGHT = 300;

export function DisplaySettings(props: DisplaySettingsProps) {
  const s = useS();
  const color = useThemeColor();
  useLanguage();
  const [compact, setCompact] = useState(false);
  const { settings, update, saving, close } = props;
  return <View style={s.panel} accessibilityLabel={t("client.remoteDesktop.displaySettings")}
    onLayout={({ nativeEvent }) => setCompact(nativeEvent.layout.height <= COMPACT_PANEL_HEIGHT)}>
    <View style={[s.header, compact && s.compactHeader]}>
      <MaterialCommunityIcons name="monitor" size={30} color={color("#a8c8ff", 'info')} />
      <View style={s.headerCopy}><Text style={[s.title, compact && s.compactTitle]}>{t("client.remoteDesktop.display")}</Text>
        {!compact && <Text style={s.description}>{t("client.remoteDesktop.adjustHowYourRemoteDesktopLooks")}</Text>}</View>
      <Pressable style={s.close} onPress={close} accessibilityRole="button" accessibilityLabel={t("client.mobile.closeDisplaySettings")}>
        <MaterialCommunityIcons name="close" size={22} color={color("#aab6c9", 'faint')} /></Pressable>
    </View>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
      indicatorStyle="white" nestedScrollEnabled accessibilityLabel={t("client.remoteDesktop.displaySettingsOptions")}>
      <DisplayMonitorSettings {...props} />
      <DisplayResolutionSettings {...props} />
      <DisplayFrameRateSettings {...props} />
      <DisplaySettingsSection icon="image-outline" title="client.remoteDesktop.quality" description="client.remoteDesktop.balanceClaritySmoothnessAndBandwidth">
        <View style={s.options}>{QUALITY_OPTIONS.map(item => <Pressable key={item.value} disabled={saving}
          accessibilityRole="radio" accessibilityState={{ checked: settings.quality === item.value, disabled: saving }}
          style={[s.choice, settings.quality === item.value && s.selected, saving && s.disabled]}
          onPress={() => { void update({ ...settings, quality: item.value }); }}>
          <Text style={s.choiceText}>{t(item.label)}</Text></Pressable>)}</View>
        <DisplaySettingsHint>
          {t("client.remoteDesktop.autoStartsAtTheHighestQualityAnd60FpsIf")}
        </DisplaySettingsHint>
      </DisplaySettingsSection>
      <DisplaySettingsSection icon="mouse" title="client.remoteDesktop.mouseControls" description="client.remoteDesktop.howToUseTheMouseOnYourRemoteDesktop">
        <View style={s.instructions}>{MOUSE_INSTRUCTIONS.map(text => <View style={s.instruction} key={text}>
          <Text style={s.bullet}>•</Text><Text style={s.instructionText}>{displayText(text)}</Text>
        </View>)}</View>
      </DisplaySettingsSection>
    </ScrollView>
  </View>;
}
