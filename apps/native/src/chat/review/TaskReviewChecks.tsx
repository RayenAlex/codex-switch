import { displayText } from '../../i18n/index';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { t, useLanguage } from '../../i18n';
import { checkStatus, type CheckKind } from '../../../../../shared/remote-chat/taskReview';
import type { TaskReviewModel } from '../../../../../shared/remote-chat/useTaskReview';
import { useStyles } from '../styles';
import { useReviewStyles as useCss } from './styles';
import { ReviewButton } from './ReviewButton';

const LABELS = { notRun: "client.taskReview.notRun", running: "client.taskReview.running", passed: "client.taskReview.passed", failed: "client.taskReview.failed",
  stale: "client.taskReview.resultIsOutOfDate", interrupted: "client.taskReview.checkInterrupted" };

export function TaskReviewChecks({ model }: { model: TaskReviewModel }) {
  const css = useCss();
  const styles = useStyles();
  useLanguage();
  const [confirm, setConfirm] = useState<CheckKind | null>(null);
  const [output, setOutput] = useState<CheckKind | null>(null);
  const snapshot = model.snapshot;
  if (!snapshot) return null;
  const command = snapshot.commands.find(row => row.kind === confirm);
  return <View style={css.section}>
    <Text style={styles.title}>{t("client.taskReview.projectChecks")}</Text>
    <Text style={css.notice}>{t("client.taskReview.checksRunAgainstTheCurrentProjectClaimsInChatDo")}</Text>
    <Text style={css.code}>{t("client.taskReview.codeVersion")}：{snapshot.revision.head?.slice(0, 8) || t("client.taskReview.noCommitYet")}
      {' / '}{snapshot.revision.id.slice(0, 10)}</Text>
    {(['build', 'lint', 'test'] as const).map(kind => {
      const plan = snapshot.commands.find(row => row.kind === kind);
      const record = snapshot.checks.find(row => row.kind === kind);
      return <View style={css.stack} key={kind}>
        <View style={css.row}><Text style={[styles.title, styles.fill]}>{kind}</Text>
          <Text style={styles.subtitle}>{displayText(LABELS[checkStatus(record, snapshot.revision)])}</Text>
          {plan && <ReviewButton label={t("client.taskReview.runCheck")} disabled={!model.enabled || model.busy || model.running}
            onPress={() => setConfirm(kind)} />}</View>
        <Text style={css.notice}>{plan?.command || t("client.taskReview.thisCheckIsNotConfiguredForTheProject")}</Text>
        {record && <ReviewButton label={t(output === kind ? "client.taskReview.hideCheckRecord" : "client.taskReview.viewCheckRecord")}
          onPress={() => setOutput(output === kind ? null : kind)} />}
        {record && output === kind && <>
          <Text style={css.code}>{record.command} · {record.revision.slice(0, 10)}
            {' · '}{new Date(record.startedAt).toLocaleString()}
            {record.exitCode != null && ` · exit ${record.exitCode}`}</Text>
          <ScrollView style={css.output} nestedScrollEnabled><Text selectable style={css.code}>
            {record.output || t("client.taskReview.waitingForTheCheckToFinish")}</Text></ScrollView>
        </>}
      </View>;
    })}
    {command && <View style={css.confirm}>
      <Text style={css.notice}>{t("client.taskReview.thisRunsAProjectCommandOnYourComputerAndMay")}</Text>
      <Text style={css.code}>{command.command}</Text>
      <View style={css.row}><ReviewButton label={t("client.taskReview.confirmCheck")}
        disabled={!model.enabled || model.busy || model.running}
        onPress={() => { setConfirm(null); void model.run(command.kind); }} />
        <ReviewButton label={t("client.accounts.cancel")} onPress={() => setConfirm(null)} /></View>
    </View>}
  </View>;
}
