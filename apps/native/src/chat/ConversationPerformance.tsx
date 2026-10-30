import { Text } from 'react-native';
import { CONVERSATION_TSR_DESCRIPTION, formatConversationTsr } from '../../../../shared/remote-chat/commandMetrics';
import { t, useLanguage } from '../i18n';
import { useConversationMetrics } from '../../../../shared/remote-chat/client/useConversationMetrics';
import { CONVERSATION_TPS_DESCRIPTION, CONVERSATION_TTFT_DESCRIPTION, formatConversationTps, formatConversationTtft,
  type ConversationMetrics, type ReadConversationMetrics } from '../../../../shared/remote-chat/conversationMetrics';

export function ConversationPerformance({ read, threadId, active }: {
  read: ReadConversationMetrics; threadId: string | null; active: boolean;
}) {
  const metrics = useConversationMetrics(read, threadId, active);
  return <ConversationPerformanceValues metrics={metrics} />;
}

export function ConversationPerformanceValues({ metrics }: { metrics: ConversationMetrics | null }) {
  useLanguage();
  // Nested spans inherit ChatUsage's text metrics; keep each value and abbreviation on the same line.
  const success = `${formatConversationTsr(metrics)}\u00a0TSR`;
  const speed = `${formatConversationTps(metrics)}\u00a0TPS`;
  const firstToken = `${formatConversationTtft(metrics)}\u00a0TTFT`;
  return <>
    <Text accessibilityLabel={t('client.chat.commandSuccessRateValue', { value: success })}
      accessibilityHint={t(CONVERSATION_TSR_DESCRIPTION)}>{success}</Text>
    {' · '}
    <Text accessibilityLabel={`${t("client.mobile.conversationOutputSpeed")} ${speed}`}
      accessibilityHint={t(CONVERSATION_TPS_DESCRIPTION)}>{speed}</Text>
    {' · '}
    <Text accessibilityLabel={`${t("client.mobile.timeToFirstToken")} ${firstToken}`}
      accessibilityHint={t(CONVERSATION_TTFT_DESCRIPTION)}>{firstToken}</Text>
  </>;
}
