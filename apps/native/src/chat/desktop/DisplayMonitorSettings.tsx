import { displayText } from '../../i18n/index';
import { useThemeColor } from '../../theme/store';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { displayLabel, displayName } from '../../../../../shared/remote-desktop/displays';
import type { DisplaySettingsProps } from '../../../../../shared/remote-desktop/displaySettings';
import { t } from '../../i18n';
import { DisplaySettingsSection } from './DisplaySettingsSection';
import { useDisplaySettingsStyles as useS } from './displaySettingsStyles';

export function DisplayMonitorSettings({ displays, settings, saving, update, stats }: DisplaySettingsProps) {
  const s = useS();
  const color = useThemeColor();
  return <DisplaySettingsSection icon="monitor" title="client.remoteDesktop.monitor" description="client.remoteDesktop.chooseTheMonitorToUse">
    {displays.length > 0 && <View style={s.monitorGrid}>
      {displays.map(item => <Pressable key={item.id} disabled={saving} accessibilityRole="radio"
        accessibilityLabel={displayLabel(item, displayText)}
        accessibilityState={{ checked: settings.displayId === item.id, disabled: saving }}
        style={[s.monitorCard, settings.displayId === item.id && s.monitorSelected, saving && s.disabled]}
        onPress={() => { void update({ ...settings, displayId: item.id }); }}>
        <View style={[s.monitorCheck, settings.displayId === item.id && s.monitorChecked]}>
          {settings.displayId === item.id && <MaterialCommunityIcons name="check" size={12} color="#fff" />}
        </View>
        <View style={s.monitorPreview} accessible={false}>
          <View style={s.monitorWave} /><View style={s.monitorShine} />
        </View>
        <Text style={s.monitorName}>{displayName(item, displayText)}{item.primary && `（${t("client.remoteDesktop.primary")}）`}</Text>
        <Text style={s.monitorResolution}>{item.width} × {item.height}</Text>
      </Pressable>)}
    </View>}
    <Pressable style={s.toggle} accessibilityRole="switch" accessibilityLabel={t("client.remoteDesktop.hideConnectionStats")}
      accessibilityState={{ checked: !stats.visible }} onPress={stats.toggle}>
      <MaterialCommunityIcons name="view-dashboard-outline" size={20} color={color("#7e9bc6", 'info')} />
      <View style={s.headerCopy}><Text style={s.text}>{t("client.remoteDesktop.hideConnectionStats")}</Text>
        <Text style={s.toggleDescription}>{t("client.remoteDesktop.keepConnectionStatsOffTheScreen")}</Text></View>
      <View style={[s.switchTrack, !stats.visible && s.switchOn]}>
        <View style={[s.switchThumb, !stats.visible && s.switchThumbOn]} /></View>
    </Pressable>
  </DisplaySettingsSection>;
}
