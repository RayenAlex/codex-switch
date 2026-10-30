import { Pressable, Text, TextInput, View } from 'react-native';
import type { RemoteGit } from '../../../../../shared/remote-chat/useRemoteGit';
import { t, useLanguage } from '../../i18n';
import { useThemeColor } from '../../theme/store';
import { palette } from '../styles';
import { useGitStyles } from './styles';
import { GitSelectionMark } from './GitTreeIcon';

export function GitCommitForm({ panel }: { panel: RemoteGit }) {
  const styles = useGitStyles();
  const color = useThemeColor();
  useLanguage();
  return <View style={styles.form}>
    <TextInput accessibilityLabel={t("client.git.commitMessage")} multiline maxLength={4000} value={panel.message}
      placeholder={t(panel.autoMessage ? "client.gitMessage.generateAMessageFromSelectedFilesWhenCommitting" : "client.gitMessage.writeACommitMessageOrTapGenerateWithAi")}
      placeholderTextColor={color(palette.muted, 'muted')} editable={!panel.busy && !panel.autoMessage}
      style={[styles.input, (panel.busy || panel.autoMessage) && styles.inputDisabled]}
      onChangeText={panel.setMessage} onKeyPress={event => {
        if (event.nativeEvent.key !== 'Tab' || panel.message.trim() || !panel.canGenerateMessage) return;
        event.preventDefault(); void panel.generateMessage();
      }} />
    <View style={styles.messageOptions}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={t("client.gitMessage.generateCommitMessageAutomatically")}
        accessibilityState={{ checked: panel.autoMessage, disabled: panel.busy || panel.settingsBusy }}
        disabled={panel.busy || panel.settingsBusy}
        style={styles.checkButton} onPress={() => void panel.setAutoMessage(!panel.autoMessage)}>
        <GitSelectionMark checked={panel.autoMessage} /><Text style={styles.hint}>{t("client.gitMessage.generateCommitMessageAutomatically")}</Text>
      </Pressable>
      {!panel.autoMessage && !panel.message.trim() && <Pressable accessibilityRole="button"
        disabled={!panel.canGenerateMessage} style={[styles.button, !panel.canGenerateMessage && styles.disabled]}
        onPress={() => void panel.generateMessage()}><Text style={styles.buttonText}>{t("client.gitMessage.generateWithAi")}</Text></Pressable>}
    </View>
    {panel.generatingMessage && <Text accessibilityLiveRegion="polite" style={styles.hint}>
      {t("client.gitMessage.generatingCommitMessage")}</Text>}
    <View style={styles.commitActions}>
      <Pressable accessibilityRole="button" disabled={!panel.canCommit}
        style={[styles.submit, styles.fill, !panel.canCommit && styles.disabled]} onPress={() => void panel.commit()}>
        <Text style={styles.submitText}>{t("client.git.commitFiles", { count: Object.keys(panel.selected).length })}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={!panel.canCommitAndPush}
        style={[styles.submit, styles.fill, !panel.canCommitAndPush && styles.disabled]}
        onPress={() => void panel.commit({ push: true })}><Text style={styles.submitText}>{t("client.git.commitAndPush")}</Text>
      </Pressable>
    </View>
  </View>;
}
