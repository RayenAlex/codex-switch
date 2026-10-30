import type { MessageKey } from '@remoteai/i18n';
import { t, useLanguage } from '../i18n';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { TokenSummary } from '../../../../shared/remote-chat/tokenSummary';
import { buildQuotaChartData, type QuotaInterval, type QuotaView } from
  '../../../desktop/src/components/TokenUsageDashboard/quotaHistoryData';
import { quotaChartLabels } from '../../../desktop/src/components/TokenUsageDashboard/quotaChartLabels';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { TimeBars } from './TimeBars';
import { quotaPoints } from './quotaPoints';
import { useSummaryStyles as useS } from './styles';

const intervals: Array<[QuotaInterval, MessageKey]> = [['hour', 'client.chat.hourly'], ['sixHours', 'client.chat.every6Hours'], ['day', 'client.chat.daily']];
const views: Array<[QuotaView, MessageKey]> = [['drop', 'client.chat.usagePerPeriod'], ['remaining', 'client.accounts.remainingQuota']];

export function QuotaPanel({ data }: { data: TokenSummary }) {
  const s = useS();
  const language = useLanguage();
  const [accountId, setAccountId] = useState<string>();
  const [interval, setInterval] = useState<QuotaInterval>('sixHours');
  const [view, setView] = useState<QuotaView>('drop');
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const selected = data.quotaHistory.find((account) => account.accountId === accountId) ?? data.quotaHistory[0];
  const labels = quotaChartLabels(language);
  const chart = useMemo(() => buildQuotaChartData({ points: selected?.points ?? [],
    startTs: data.startTs, endTs: data.endTs, interval, view }), [selected, data.startTs, data.endTs, interval, view]);
  const points = useMemo(() => quotaPoints(chart), [chart]);
  return <View style={s.card}><Text style={s.sectionTitle}>{labels.title}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.chooseQuotaAccount")} style={[s.chip, s.selected]}
      onPress={() => { setQuery(''); setPicking(true); }}>
      <Text style={s.action}>{selected?.accountLabel ?? labels.noAccounts} ﹀</Text>
    </Pressable>
    <View style={s.wrap}>{views.map(([value, label]) => <Pressable key={value} accessibilityRole="button"
      accessibilityState={{ selected: view === value }} style={[s.chip, view === value && s.selected]}
      onPress={() => setView(value)}><Text style={s.action}>{t(label)}</Text></Pressable>)}</View>
    <View style={s.wrap}>{intervals.map(([value, label]) => <Pressable key={value} accessibilityRole="button"
      accessibilityState={{ selected: interval === value }} style={[s.chip, interval === value && s.selected]}
      onPress={() => setInterval(value)}><Text style={s.action}>{t(label)}</Text></Pressable>)}</View>
    {data.errors.quota ? <Text style={s.error}>{labels.error}</Text>
      : chart.hasData ? <TimeBars key={`${selected?.accountId}:${interval}:${view}`} points={points}
        labels={[labels.primary, labels.secondary]} unit={view === 'drop' ? 'points' : '%'} />
        : <Text style={s.hint}>{labels.empty}</Text>}
    <Text style={s.hint}>{view === 'drop' ? labels.dropHint : t("client.chat.showsRemainingQuotaAtEachRefreshPeriodsWithoutRecordsAre")}</Text>
    <Text style={s.hint}>{labels.historyHint}</Text>
    <BottomSheet visible={picking} title={t("client.chat.chooseQuotaAccount")} onClose={() => setPicking(false)}>
      <TextInput accessibilityLabel={t("client.mobile.searchQuotaAccounts")} placeholder={t("client.chat.searchAccounts")} value={query} onChangeText={setQuery}
        style={[s.input, { textAlign: 'left', paddingHorizontal: 12 }]} />
      <SheetScrollView>{data.quotaHistory.filter((account) => account.accountLabel.toLowerCase()
        .includes(query.trim().toLowerCase())).map((account) => <Pressable key={account.accountId}
        accessibilityRole="button" style={s.button} onPress={() => { setAccountId(account.accountId); setPicking(false); }}>
        <Text style={s.action}>{account.accountLabel}</Text>
      </Pressable>)}</SheetScrollView>
    </BottomSheet>
  </View>;
}
