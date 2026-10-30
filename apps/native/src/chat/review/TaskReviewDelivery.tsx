import { displayError } from '../../i18n/index';
import { useState } from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import { t, useLanguage } from '../../i18n';
import type { TaskReviewModel } from '../../../../../shared/remote-chat/useTaskReview';
import { resultSummary } from '../../../../../shared/remote-chat/taskReview';
import type { Turn } from '../types';
import { useStyles } from '../styles';
import { useReviewStyles as useCss } from './styles';
import { ReviewButton } from './ReviewButton';

export function TaskReviewDelivery({ model, turn }: { model: TaskReviewModel; turn: Turn }) {
  const css = useCss();
  const styles = useStyles();
  useLanguage();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(resultSummary(turn).slice(0, 80));
  const [body, setBody] = useState(resultSummary(turn));
  const [base, setBase] = useState('');
  const [linkError, setLinkError] = useState('');
  const pr = model.pullRequest;
  const revision = model.snapshot?.revision;
  const current = !!revision && !revision.dirty && pr?.headRefOid === revision.head;
  return <View style={css.section}>
    <Text style={styles.title}>{t("client.taskReview.prAndCi")}</Text>
    <ReviewButton label={t("client.taskReview.refreshPrAndCi")} disabled={!model.enabled || model.busy}
      onPress={() => { void model.loadPr(); }} />
    {!!model.prError && <Text accessibilityRole="alert" style={css.error}>{displayError(model.prError)}</Text>}
    {pr && <>
      <ReviewButton label={`#${pr.number} ${pr.title}`} disabled={!/^https:\/\//i.test(pr.url)}
        onPress={() => { void Linking.openURL(pr.url).catch(() => setLinkError('无法打开链接，请稍后重试。')); }} />
      {!!linkError && <Text style={css.error}>{displayError(linkError)}</Text>}
      <Text style={css.code}>{t("client.taskReview.prCommit")}：{pr.headRefOid.slice(0, 10)}</Text>
      {!current && <Text style={css.notice}>{t("client.taskReview.ciRefersToADifferentCodeVersionCommitAndPush")}</Text>}
      {!pr.statusCheckRollup?.length && <Text style={css.notice}>{t("client.taskReview.noCiResultsYet")}</Text>}
      {pr.statusCheckRollup?.map((check, index) => <Text style={styles.messageText} key={index}>
        {check.name || check.context || 'CI'}：{check.conclusion || check.state || check.status || t("client.chatReliability.awaitingConfirmation")}</Text>)}
    </>}
    {model.prLoaded && !pr && <Text style={css.notice}>{t("client.taskReview.thereIsNoOpenPrForThisBranch")}</Text>}
    {!pr && <ReviewButton label={t("client.taskReview.createDraftPr")} onPress={() => setCreating(!creating)}
      disabled={!model.enabled || model.busy || !revision || revision.dirty} />}
    {revision?.dirty && <Text style={css.notice}>{t("client.taskReview.commitAndPushYourChangesFromGitBeforeCreatingA")}</Text>}
    {creating && !pr && <View style={css.form}>
      <Text style={styles.subtitle}>{t("client.taskReview.prTitle")}</Text>
      <TextInput accessibilityLabel={t("client.taskReview.prTitle")} style={css.input} value={title} maxLength={200} onChangeText={setTitle} />
      <Text style={styles.subtitle}>{t("client.taskReview.baseBranchLeaveBlankForDefault")}</Text>
      <TextInput accessibilityLabel={t("client.taskReview.baseBranchLeaveBlankForDefault")} style={css.input} value={base}
        maxLength={200} onChangeText={setBase} />
      <Text style={styles.subtitle}>{t("client.taskReview.prDescription")}</Text>
      <TextInput accessibilityLabel={t("client.taskReview.prDescription")} style={[css.input, { minHeight: 100 }]} value={body}
        multiline maxLength={16_000} onChangeText={setBody} />
      <ReviewButton label={t("client.taskReview.confirmDraftPr")}
        disabled={!title.trim() || model.busy || !model.enabled || !revision || revision.dirty}
        onPress={() => { void model.createPr({ title, body, base }); }} />
    </View>}
  </View>;
}

export function TaskReviewRestore({ model }: { model: TaskReviewModel }) {
  const css = useCss();
  const styles = useStyles();
  useLanguage();
  return <View style={css.section}>
    <Text style={styles.title}>{t("client.taskReview.restoreThisTurnSChanges")}</Text>
    <Text style={css.notice}>{t("client.taskReview.newChangesAreCheckedFirstConflictingFilesWillNotBe")}</Text>
    {model.restored ? <Text style={styles.messageText}>{t("client.taskReview.thisTurnSChangesHaveBeenRestored")}</Text>
      : <ReviewButton label={t("client.taskReview.previewRestore")} disabled={!model.enabled || model.busy || model.running}
        onPress={() => { void model.previewRestore(); }} />}
    {model.restore && <View style={css.confirm}>
      <Text style={css.notice}>{t(model.restore.conflict ? "client.taskReview.filesContainOtherChangesAndCannotBeRestoredSafelyReview"
        : "client.taskReview.noConflictsFoundInThePreviewFilesWillBeChecked")}</Text>
      {model.restore.files.map(path => <Text style={css.code} key={path}>{path}</Text>)}
      <ReviewButton label={t("client.taskReview.confirmRestore")}
        disabled={model.restore.conflict || model.busy || model.running || !model.enabled}
        onPress={() => { void model.confirmRestore(); }} />
    </View>}
  </View>;
}
