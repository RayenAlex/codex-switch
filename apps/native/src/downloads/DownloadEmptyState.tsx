import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors, useStyles } from './styles';

export function DownloadEmptyState() {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  return <View style={styles.empty}>
    <View style={styles.emptyHalo}>
      <View style={styles.emptyIcon}><Ionicons name="download-outline" size={34} color={color(colors.green, 'accent')} /></View>
      <View style={styles.emptyBadge}><Ionicons name="add" size={16} color={color(colors.surface, 'surface')} /></View>
    </View>
    <Text style={styles.emptyTitle}>{t("client.mobile.noDownloadsYet")}</Text>
    <Text style={styles.emptyText}>{t("client.mobile.browseFilesAboveOrDownloadThemFromAChat")}{'\n'}{t("client.mobile.downloadProgressAndSavedFilesAppearHere")}</Text>
  </View>;
}
