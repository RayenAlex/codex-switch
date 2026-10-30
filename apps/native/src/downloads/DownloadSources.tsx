import { displayText } from '../i18n/index';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { downloadConnectionLabel } from '../../../../shared/remote-chat/downloadConnection';
import type { DownloadConnection } from './types';
import { colors, useStyles } from './styles';

function SourceCard({ scope, disabled, onPress }: {
  scope: 'project' | 'computer'; disabled: boolean; onPress: () => void;
}) {
  const resolveThemeColor = useThemeColor();
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const project = scope === 'project';
  return <Pressable accessibilityRole="button" accessibilityLabel={project ? t("client.downloads.currentProject") : t("client.downloads.thisComputer")}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.sourceCard, disabled && styles.disabled, pressed && styles.pressed]}>
    <View style={[styles.sourceIcon, !project && styles.computerIcon]}>
      <Ionicons name={project ? 'folder-outline' : 'desktop-outline'} size={20}
        color={project ? resolveThemeColor(colors.green, 'accent') : resolveThemeColor(colors.blue, 'info')} />
    </View>
    <View style={styles.sourceCopy}>
      <Text style={styles.sourceTitle}>{project ? t("client.downloads.currentProject") : t("client.downloads.thisComputer")}</Text>
      <Text style={styles.caption}>{project ? t("client.mobile.browseProjectFiles") : t("client.mobile.browseComputerFiles")}</Text>
    </View>
    <Ionicons name="chevron-forward" size={12} color={color(colors.muted, 'muted')} />
  </Pressable>;
}

export function DownloadSources({ connection, browse }: {
  connection?: DownloadConnection; browse: (scope: 'project' | 'computer') => void;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const ready = !!connection?.ready;
  const canBrowseProject = ready && !!(connection.cwd || connection.threadId);
  let hint = '';
  if (!ready) hint = t("client.mobile.connectToAComputerInChatToAddDownloads");
  else if (!canBrowseProject) hint = t("client.mobile.chooseAProjectInChatOrAddDownloadsFromThis");
  return <View style={styles.sources}>
    <View style={styles.sourceHeading}>
      <Text style={styles.sectionLabel}>{t("client.mobile.addDownload")}</Text>
      <View style={styles.connection}>
        <View style={[styles.connectionDot, !ready && styles.offlineDot]} />
        <Text style={styles.connectionName} numberOfLines={1}>{connection?.deviceName || t("client.mobile.noComputerConnected")}</Text>
        {!!connection && <Text style={styles.caption}>{displayText(downloadConnectionLabel(connection.mode))}</Text>}
      </View>
    </View>
    <View style={styles.sourceRow}>
      <SourceCard scope="project" disabled={!canBrowseProject} onPress={() => browse('project')} />
      <SourceCard scope="computer" disabled={!ready} onPress={() => browse('computer')} />
    </View>
    {!!hint && <View style={styles.hint}>
      <Ionicons name="information-circle-outline" size={15} color={color(colors.muted, 'muted')} />
      <Text style={styles.hintText}>{hint}</Text>
    </View>}
  </View>;
}
