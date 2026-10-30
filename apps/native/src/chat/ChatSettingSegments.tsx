import { Pressable, Text, View } from 'react-native';
import type { SettingOption } from '../../../../shared/remote-chat/settingsMenu';
import { settingSegmentColor } from '../../../../shared/remote-chat/settingSegments';
import { displayText } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { palette } from './styles';
import { useSettingSegmentDrag } from './useSettingSegmentDrag';

interface Props {
  label: string;
  value: string;
  options: SettingOption[];
  onChange: (value: string) => void;
}

export function ChatSettingSegments({ label, value, options, onChange }: Props) {
  const styles = useStyles();
  const { track, preview, panHandlers } = useSettingSegmentDrag(options.length, index => {
    const option = options[index];
    if (option) onChange(option.value);
  });
  const selected = options.findIndex(option => option.value === value);
  const active = preview ?? selected;
  const accent = settingSegmentColor(active, options.length);
  if (!options.length) return null;
  return <View style={styles.rail} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <View ref={track} collapsable={false} style={styles.track} {...panHandlers}>
        {active >= 0 && <View pointerEvents="none" style={[styles.thumb, {
          left: `${active / options.length * 100}%`, width: `${100 / options.length}%`, backgroundColor: accent,
        }]} />}
        {options.map((option, index) => <Pressable key={option.value} accessibilityRole="radio"
          accessibilityLabel={displayText(option.label)} accessibilityState={{ checked: selected === index }}
          accessibilityHint={option.description ? displayText(option.description) : undefined}
          style={styles.option} onPress={() => onChange(option.value)}>
          <Text style={[styles.optionText, active === index && styles.selectedText]}>{displayText(option.label)}</Text>
        </Pressable>)}
      </View>
  </View>;
}

const useStyles = createThemedStyles(color => ({
  rail: { padding: 3, borderRadius: 12, backgroundColor: color('#eef3f0', 'canvas') },
  track: { flexDirection: 'row', position: 'relative' },
  thumb: { position: 'absolute', top: 0, bottom: 0, borderRadius: 9 },
  option: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 4, paddingVertical: 6,
    alignItems: 'center', justifyContent: 'center' },
  optionText: { ...textMetrics(13, 20), textAlign: 'center', color: color(palette.muted, 'muted'), fontWeight: '600' },
  selectedText: { color: '#fff' },
}));
