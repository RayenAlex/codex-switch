import { useThemeColor } from '../theme/store';
import { displayError, t, useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Storage from 'expo-sqlite/kv-store';
import { MAX_SUMMARY_WEEKS, MIN_SUMMARY_WEEKS, type ReadTokenSummary } from
  '../../../../shared/remote-chat/tokenSummary';
import { useTokenSummary } from '../../../../shared/remote-chat/client/useTokenSummary';
import { UsageTotals, UsageTrend, RankingPanel } from './UsagePanels';
import { ConsumptionPanels } from './ConsumptionPanels';
import { UsageHeatmap } from './UsageHeatmap';
import { QuotaPanel } from './QuotaPanel';
import { OfficialUsagePanel } from './OfficialUsagePanel';
import { useSummaryStyles as useS } from './styles';

interface Props {
  read: ReadTokenSummary; ready: boolean; foreground: boolean; scope: string; deviceName?: string; onBack: () => void;
}

export function TokenSummaryPage({ read, ready, foreground, scope, deviceName, onBack }: Props) {
  const s = useS();
  const color = useThemeColor();
  useLanguage();
  const summary = useTokenSummary({ read, active: ready && foreground, scope, storage: Storage });
  const { data, loading, error } = summary;
  const [draftWeeks, setDraftWeeks] = useState('');
  useEffect(() => { setDraftWeeks(summary.weeks?.toString() ?? ''); }, [summary.weeks]);
  const applyWeeks = () => {
    const value = Number(draftWeeks);
    if (!Number.isInteger(value) || value < MIN_SUMMARY_WEEKS || value > MAX_SUMMARY_WEEKS) {
      setDraftWeeks(summary.weeks?.toString() ?? ''); return;
    }
    if (value !== summary.weeks) summary.changeWeeks(value);
  };
  return <View style={s.page}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.discovery.back")} style={s.button} onPress={onBack}>
        <Feather name="arrow-left" size={24} color={color("#17211b", 'ink')} />
      </Pressable><Text accessibilityRole="header" style={[s.title, s.fill]}>{t("client.chat.tokenSummary")}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.refreshTokenSummary")} style={s.button}
        disabled={!ready || loading} onPress={summary.refresh}>
        {loading ? <ActivityIndicator color={color("#0b8065", 'accent')} /> : <Feather name="refresh-cw" size={20} color={color("#0b8065", 'accent')} />}
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={summary.refresh} enabled={ready}
        tintColor={color("#0b8065", 'accent')} colors={['#0b8065']} />}>
      <View style={{ gap: 8 }}><Text style={s.hint}>{deviceName || t("client.chatReliability.noComputerSelected")}{' '}{t("client.chat.tokenUsageThroughTheProxyOnly")}</Text>
        <View style={s.row}><Text style={s.hint}>{t("client.chat.recent")}</Text>
          <TextInput accessibilityLabel={t("client.chat.numberOfWeeks1To52")} style={s.input} value={draftWeeks}
            keyboardType="number-pad" maxLength={2} onChangeText={setDraftWeeks}
            onEndEditing={applyWeeks} onSubmitEditing={applyWeeks} returnKeyType="done" />
          <Text style={[s.hint, s.fill]}>{t("client.chat.weeks")}</Text>
          <Pressable accessibilityRole="button" style={s.button} onPress={applyWeeks}>
            <Text style={s.action}>{t("client.chat.apply")}</Text></Pressable>
        </View>
        {data && <Text style={s.hint}>{t("client.accounts.updated")}{' '}{new Date(data.endTs * 1000).toLocaleTimeString()}</Text>}
      </View>
      {!ready && <Text style={s.error}>{t("client.chat.connectToYourComputerToViewTokenUsage")}</Text>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{displayError(error)}</Text>}
      {loading && !data && <Text style={s.hint}>{t("client.mobile.loadingSummary")}</Text>}
      {data && <>
        <UsageTotals data={data} />
        <QuotaPanel data={data} />
        <OfficialUsagePanel data={data} />
        <ConsumptionPanels data={data} />
        <UsageHeatmap data={data} />
        <UsageTrend data={data} />
        <RankingPanel title={t("client.chat.providerUsageRanking")} ranking={data.rankings.providers} count={data.entryCount} />
        <RankingPanel title={t("client.chat.modelUsageRanking")} ranking={data.rankings.models} count={data.entryCount} />
        <RankingPanel title={t("client.chat.accountUsageRanking")} ranking={data.rankings.accounts} count={data.entryCount} />
      </>}
    </ScrollView>
  </View>;
}
