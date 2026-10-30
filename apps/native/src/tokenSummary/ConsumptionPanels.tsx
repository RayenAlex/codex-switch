import { CONTEXT_FIELDS, MODE_FIELDS, type ConsumptionField }
  from '../../../../shared/remote-chat/tokenSummaryLabels';
import { t, useLanguage } from '../i18n';
import { Text, View } from 'react-native';
import type { TokenSummary } from '../../../../shared/remote-chat/tokenSummary';
import { formatTokens } from '../../../desktop/src/components/TokenUsageDashboard/chartUtils';
import { TimeBars } from './TimeBars';
import { useSummaryStyles as useS } from './styles';

function ConsumptionPanel({ data, title, fields, hint }: {
  data: TokenSummary; title: string; fields: readonly ConsumptionField[]; hint: string;
}) {
  const s = useS();
  const language = useLanguage();
  const totals = fields.map(([, field]) => data.breakdown.reduce((sum, day) => sum + day[field], 0));
  const total = totals.reduce((sum, tokens) => sum + tokens, 0);
  const byDate = new Map(data.breakdown.map((day) => [day.date, day]));
  return <View style={s.card}><Text style={s.sectionTitle}>{title}</Text><Text style={s.hint}>{hint}</Text>
    {data.errors.analytics ? <Text style={s.error}>{t("client.chat.couldNotLoadUsagePleaseRefreshToTryAgain")}</Text> : <>
      <View style={s.wrap}>{fields.map(([name], index) => <View key={name} style={s.metric}>
        <Text style={s.hint}>{t(name)}</Text><Text style={s.value}>{formatTokens(totals[index], language)}</Text>
        <Text style={s.hint}>{total ? `${(totals[index] / total * 100).toFixed(1)}%` : '—'}</Text>
      </View>)}</View>
      {total > 0 ? <TimeBars labels={fields.map(([name]) => t(name))} points={data.dateKeys.map((date) => ({
        label: date, values: fields.map(([, field]) => byDate.get(date)?.[field] ?? 0),
      }))} /> : <Text style={s.hint}>{t("client.mobile.noTokenUsageInThisPeriod")}</Text>}
    </>}
  </View>;
}

export function ConsumptionPanels({ data }: { data: TokenSummary }) {
  useLanguage();
  return <>
    <ConsumptionPanel data={data} title={t("client.chat.shortLongContextUsage")} fields={CONTEXT_FIELDS}
      hint={t("client.mobile.inputsAboveTokensIncludingCacheCountAsLongContextUsage", { value1: data.thresholdTokens.toLocaleString() })} />
    <ConsumptionPanel data={data} title={t("client.chat.standardFastModeUsage")} fields={MODE_FIELDS}
      hint={t("client.chat.dailyTokenTotalsUsageWithoutARecordedModeIsShown")} />
  </>;
}
