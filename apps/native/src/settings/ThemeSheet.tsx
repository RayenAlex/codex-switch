import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { THEME_PREFERENCE_OPTIONS, type ThemePreference } from '../../../../shared/theme/mode';
import { BottomSheet } from '../components/BottomSheet';
import { t } from '../i18n';
import { setThemeMode, useThemePreference } from '../theme/preference';
import { useStyles } from './styles';

export function ThemeSheet({ onClose }: { onClose: () => void }) {
  const preference = useThemePreference();
  const styles = useStyles();
  const [error, setError] = useState(false);
  const choose = async (next: ThemePreference) => {
    if (await setThemeMode(next)) onClose();
    else setError(true);
  };
  return <BottomSheet visible title={t("client.workspaceSettings.appearance")} onClose={onClose} maxWidth={400}>
    <View style={styles.sheetBody} accessibilityRole="radiogroup">
      {THEME_PREFERENCE_OPTIONS.map(option => <Pressable key={option.value} accessibilityRole="radio"
        accessibilityLabel={t(option.label)} accessibilityState={{ checked: preference === option.value }}
        style={styles.themeOption} onPress={() => void choose(option.value)}>
        <Text style={styles.detailLabel}>{t(option.label)}</Text>
        <View style={styles.spacer} />
        {preference === option.value && <Text style={styles.detailLabel}>✓</Text>}
      </Pressable>)}
      {error && <Text accessibilityRole="alert" style={styles.error}>
        {t("client.settings.appearanceChangedButCouldNotBeSavedPleaseChooseAgain")}
      </Text>}
    </View>
  </BottomSheet>;
}
