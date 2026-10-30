import { displayError } from '../../i18n/index';
import { Text, TextInput, View } from 'react-native';
import { t, useLanguage } from '../../i18n';
import type { Turn } from '../types';
import { useTaskReview } from '../../../../../shared/remote-chat/useTaskReview';
import { completedTurnFiles } from '../../../../../shared/chat/turnPresentation';
import { BottomSheet } from '../../components/BottomSheet';
import { ChatDiff } from '../ChatDiff';
import { TaskReviewChecks } from './TaskReviewChecks';
import { TaskReviewDelivery, TaskReviewRestore } from './TaskReviewDelivery';
import { ReviewButton } from './ReviewButton';
import { useStyles } from '../styles';
import { useReviewStyles as useCss } from './styles';

export function TaskReviewPanel({ turn }: { turn: Turn }) {
  const css = useCss();
  const styles = useStyles();
  useLanguage();
  const model = useTaskReview(turn);
  const comment = model.comment;
  return <View>
    {!model.enabled && <Text style={css.notice}>{t("client.taskReview.connectToYourComputerToRunChecksSendFeedbackOr")}</Text>}
    {!!model.error && <Text accessibilityRole="alert" style={css.error}>{displayError(model.error)}</Text>}
    <ReviewButton label={model.loading ? t("client.projectBrowser.loading") : t("client.taskReview.refreshReview")}
      disabled={model.loading || !model.enabled} onPress={() => { void model.refresh(); }} />
    <TaskReviewChecks model={model} />
    <View style={css.section}><Text style={styles.title}>{t("client.taskReview.thisTurnSChanges")}</Text>
      <Text style={css.notice}>{t("client.taskReview.leaveFeedbackBesideAChangedLineToContinueFixingIt")}</Text>
      {model.sent && <Text accessibilityLiveRegion="polite" style={css.notice}>{t("client.taskReview.feedbackSentToTheOriginalConversation")}</Text>}
      <ChatDiff files={completedTurnFiles(turn)} onComment={model.selectLine} />
    </View>
    <TaskReviewRestore model={model} />
    <TaskReviewDelivery model={model} turn={turn} />
    {comment && <BottomSheet visible title={t("client.taskReview.reviewFeedback")} maxWidth={400} onClose={model.closeComment}>
      <View style={css.form}>
        <Text style={css.code}>{comment.file.path} · {t(comment.line.kind === 'remove' ? "client.chat.before" : "client.chat.after")}
          {' '}{comment.line.kind === 'remove' ? comment.line.oldLine : comment.line.newLine}</Text>
        <Text selectable style={css.code}>{comment.line.text}</Text>
        <TextInput accessibilityLabel={t("client.taskReview.reviewFeedback")} placeholder={t("client.taskReview.howShouldThisLineChange")}
          value={model.feedback} multiline style={[css.input, { minHeight: 100 }]} maxLength={8_000}
          onChangeText={model.setFeedback} />
        <ReviewButton label={t("client.taskReview.sendToOriginalChat")} disabled={!model.enabled || model.busy || !model.feedback.trim()}
          onPress={() => { void model.sendComment(); }} />
        {!!model.error && <Text accessibilityRole="alert" style={css.error}>{displayError(model.error)}</Text>}
      </View>
    </BottomSheet>}
  </View>;
}
