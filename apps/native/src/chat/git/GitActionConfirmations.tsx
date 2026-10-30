import { displayError, displayText } from '../../i18n/index';
import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import type { RemoteGit } from '../../../../../shared/remote-chat/useRemoteGit';
import type { GitResetMode } from '../../../../../shared/remote-chat/gitTypes';
import { GIT_RESET_MODES } from '../../../../../shared/remote-chat/gitMenu';
import { t, useLanguage } from '../../i18n';
import { GitActionDialog, useGitActionStyles } from './GitActionDialog';

export function GitFileActionConfirmation({ panel, connected }: { panel: RemoteGit; connected: boolean }) {
  const [message, setMessage] = useState(panel.message);
  const styles = useGitActionStyles();
  useLanguage();
  const prompt = panel.fileAction;
  if (!prompt) return null;
  const committing = prompt.action === 'commit';
  const title = committing ? t("client.git.commitFiles", { count: prompt.files.length })
    : t(prompt.action === 'rollback' ? "client.git.rollBackFiles" : "client.git.deleteFile");
  const label = t(committing ? "client.mobile.submit" : prompt.action === 'rollback' ? "client.git.rollBack" : "client.mobile.confirmDeletion");
  return <GitActionDialog title={title} close={panel.cancelFileAction} busy={panel.busy}
    confirm={() => void panel.confirmFileAction(message)} label={label} danger={!committing}
    disabled={!connected || (committing && !message.trim())}>
    {prompt.files.map(file => <Text key={file.path} style={styles.text}>{file.path}</Text>)}
    {committing ? <TextInput accessibilityLabel={t("client.git.commitMessage")} multiline maxLength={4000}
      autoFocus value={message} editable={!panel.busy} onChangeText={setMessage} style={styles.input} />
      : <Text style={styles.text}>{t(prompt.action === 'rollback'
        ? "client.git.discardAllUncommittedChangesInTheseFilesAndDeleteNewly"
        : "client.git.deleteTheseFilesFromTheProjectThisCannotBeUndone")}</Text>}
    {!!panel.error && <Text accessibilityRole="alert" style={[styles.text, styles.danger]}>{displayError(panel.error)}</Text>}
  </GitActionDialog>;
}

export function GitRevisionConfirmation({ panel, connected }: { panel: RemoteGit; connected: boolean }) {
  const [mode, setMode] = useState<GitResetMode>('mixed');
  const styles = useGitActionStyles();
  useLanguage();
  const prompt = panel.revisionAction;
  if (!prompt) return null;
  const resetting = prompt.action === 'reset';
  return <GitActionDialog title={t(resetting ? "client.git.resetCurrentBranchToHere.f659aa" : "client.git.checkoutRevision.833b93")}
    close={panel.cancelRevisionAction} busy={panel.busy} disabled={!connected}
    confirm={() => void panel.confirmRevisionAction(mode)} label={t(resetting ? "client.git.resetBranch" : "client.git.checkOut")}
    danger={resetting && mode === 'hard'}>
    <Text style={styles.text}>{prompt.commit.slice(0, 12)} · {prompt.subject}</Text>
    {resetting ? <>
      <Text style={styles.text}>{t("client.git.moveBranchToTheSelectedCommit", { branch: prompt.branch ?? '' })}</Text>
      {GIT_RESET_MODES.map(item => <Pressable key={item.value} accessibilityRole="radio"
        accessibilityLabel={displayText(item.label)} accessibilityState={{ checked: mode === item.value, disabled: panel.busy }}
        disabled={panel.busy} onPress={() => setMode(item.value)} style={[styles.item,
          mode === item.value && styles.selected]}>
        <Text style={styles.label}>{mode === item.value ? '● ' : '○ '}{displayText(item.label)}</Text>
        <Text style={styles.hint}>{displayText(item.description)}</Text>
      </Pressable>)}
    </> : <Text style={styles.text}>
      {t("client.git.checkOutThisCommitWithADetachedHeadTheCurrent")}
    </Text>}
    {!!panel.error && <Text accessibilityRole="alert" style={[styles.text, styles.danger]}>{displayError(panel.error)}</Text>}
  </GitActionDialog>;
}
