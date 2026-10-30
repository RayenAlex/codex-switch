import { useThemeColor } from '../theme/store';
import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import {  Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { ChatMarkdown } from './Markdown';
import { ChatDiff } from './ChatDiff';
import { SelectableChatText } from './SelectableChatText';
import { completedTurnFiles } from './turnPresentation';
import { turnErrorNotice, type TurnPanel } from './ChatTurnSummary';
import { requestErrorDetails } from '../../../desktop/src/pages/codexGui/requestError';
import { palette, useStyles } from './styles';
import type { Turn } from './types';
import { TaskReviewPanel } from './review/TaskReviewPanel';

interface Props { turn: Turn; panel: TurnPanel; onClose: () => void }
const PANEL_TITLES: Record<TurnPanel, string> = { get plan() { return t("client.chat.taskPlan"); },
  get changes() { return t("client.chat.changesThisTurn"); }, get error() { return t("client.chat.errorDetails"); }, get result() { return t("client.taskReview.taskReview"); } };

function PlanDetails({ turn }: { turn: Turn }) {
  const resolveThemeColor = useThemeColor();
  const detailStyles = useDetailStyles();
  const styles = useStyles();
  useLanguage();
  return <View style={detailStyles.plan}>
    {!!turn.planExplanation && <ChatMarkdown text={turn.planExplanation} />}
    {turn.plan?.map((step, index) => {
      const completed = step.status === 'completed';
      const running = step.status === 'inProgress';
      return <View key={index} style={detailStyles.step}>
        <Ionicons name={completed ? 'checkmark-circle-outline' : running ? 'sync-outline' : 'ellipse-outline'}
          size={15} color={completed ? resolveThemeColor(palette.green, 'accent') : resolveThemeColor(palette.muted, 'muted')} />
        <Text style={[styles.messageText, styles.fill, running && detailStyles.activeStep]}>{step.step}</Text>
        <Text style={styles.subtitle}>{completed ? t("client.chat.completed") : running ? t("client.chat.inProgress") : t("client.chat.pending")}</Text>
      </View>;
    })}
  </View>;
}

function ErrorDetails({ turn }: { turn: Turn }) {
  const detailStyles = useDetailStyles();
  const styles = useStyles();
  useLanguage();
  const error = turn.error ?? turn.retryError;
  const text = error ? requestErrorDetails(error) : turnErrorNotice(turn);
  return <View style={detailStyles.error}>
    <SelectableChatText style={styles.messageText} copy={{ text, label: t("client.chat.copyErrorDetails") }}>{text}</SelectableChatText>
  </View>;
}

export function ChatTurnDetails({ turn, panel, onClose }: Props) {
  const detailStyles = useDetailStyles();
  useLanguage();
  return <BottomSheet fullWidthContent visible tall title={PANEL_TITLES[panel]} onClose={onClose}>
    <SheetScrollView style={detailStyles.scroll} contentContainerStyle={detailStyles.content}>
      {panel === 'result' && <TaskReviewPanel key={turn.id} turn={turn} />}
      {panel === 'plan' && <PlanDetails turn={turn} />}
      {panel === 'changes' && <ChatDiff files={completedTurnFiles(turn)} />}
      {panel === 'error' && <ErrorDetails turn={turn} />}
    </SheetScrollView>
  </BottomSheet>;
}

const useDetailStyles = createThemedStyles(() => ({
  scroll: { flexShrink: 1 },
  content: { paddingBottom: 20 },
  plan: { gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  activeStep: { fontWeight: '600' },
  error: { gap: 12, maxWidth: 400 },
}));
