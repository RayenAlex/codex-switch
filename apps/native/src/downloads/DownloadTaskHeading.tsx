import { Pressable, Text, View } from 'react-native';
import { t, useLanguage } from '../i18n';
import { useStyles } from './styles';

export function DownloadTaskHeading({ count, selected, allSelected, busy, toggleAll, remove }: {
  count: number; selected: number; busy: boolean; remove: () => void;
  allSelected: boolean; toggleAll: () => void;
}) {
  useLanguage();
  const styles = useStyles();
  const disabled = !selected || busy;
  const selectionDisabled = !count || busy;
  const selectionLabel = t(allSelected ? 'client.downloads.deselectAll' : 'client.downloads.selectAll');
  const label = selected ? t('client.downloads.deleteSelectedCount', { count: selected })
    : t('client.downloads.deleteSelected');
  return <View style={styles.sectionHeading}>
    <Text style={styles.sectionTitle}>{t('client.downloads.downloads.ea215a')}</Text>
    <View style={styles.sectionActions}>
      <Pressable accessibilityRole="button" accessibilityLabel={selectionLabel}
        accessibilityState={{ disabled: selectionDisabled }} disabled={selectionDisabled} onPress={toggleAll}
        style={({ pressed }) => [styles.batchAction, selectionDisabled && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.selectAllText}>{selectionLabel}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
        disabled={disabled} onPress={remove}
        style={({ pressed }) => [styles.batchAction, disabled && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.batchDeleteText}>{label}</Text>
      </Pressable>
      <Text style={styles.count}>{t('client.downloads.tasks', { count })}</Text>
    </View>
  </View>;
}
