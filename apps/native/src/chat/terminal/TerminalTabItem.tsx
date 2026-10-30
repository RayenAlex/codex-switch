import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { t } from '../../i18n';
import { useThemeColor } from '../../theme/store';
import { useTerminalStyles } from './styles';

export function TerminalTabItem({ label, index, selected, choose, close, maxWidth, onLayout, menu }: {
  label: string; index: number; selected: boolean; choose: () => void; close: () => void;
  maxWidth?: number; onLayout?: (event: LayoutChangeEvent) => void; menu?: boolean;
}) {
  const styles = useTerminalStyles(); const color = useThemeColor();
  return <View onLayout={onLayout} style={[styles.tab, selected && styles.selected, { maxWidth }]}>
    <Pressable accessibilityRole={menu ? 'button' : 'tab'} accessibilityLabel={label}
      accessibilityState={{ selected }} style={styles.tabSelect} onPress={choose}>
      <Text style={styles.tabLabel} numberOfLines={menu ? undefined : 1}>{label}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t('client.terminal.closeTab', { number: index + 1 })}
      style={styles.tabClose} onPress={close}>
      <Ionicons name="close-outline" size={18} color={color('#718078', 'muted')} />
    </Pressable>
  </View>;
}
