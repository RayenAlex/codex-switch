import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { UsageSummary, UsageWindow } from '../types';
import { detailColors as colors, useDetailStyles as useStyles } from './detailStyles';
import { displayDate, resetLabel } from './formatters';

export type UsageHelp = 'primary' | 'secondary';

function UsageMeter({ title, usage, secondary, onHelp }: {
  title: string; usage?: UsageWindow | null; secondary: boolean; onHelp: () => void;
}) {
  const styles = useStyles();
  const themedColor = useThemeColor();
  useLanguage();
  const remaining = usage && Number.isFinite(usage.remainingPercent)
    ? Math.max(0, Math.min(100, Math.round(usage.remainingPercent))) : null;
  let color = secondary ? themedColor(colors.blue, 'info') : themedColor(colors.green, 'accent');
  if (remaining !== null && remaining <= 15) color = themedColor(colors.danger, 'danger');
  else if (remaining !== null && remaining <= 40) color = themedColor(colors.warning, 'warning');
  return <View style={styles.meter}>
    <View style={styles.meterHeading}>
      <Text style={styles.meterTitle}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.accounts.about", { value1: title })} onPress={onHelp}
        style={styles.iconButton}>
        <Ionicons name="help-circle" size={15} color={themedColor("#98a4af", 'muted')} />
      </Pressable>
      <View style={styles.spacer} />
      <Text style={[styles.remaining, { color }]}>{remaining === null ? '--' : `${remaining}%`}</Text>
      <Text style={styles.remainingUnit}>{t("client.accounts.remaining")}</Text>
    </View>
    <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel={t("client.accounts.remainingQuota.8e22d4", { value1: title })}
      accessibilityValue={remaining === null ? { text: t("client.accounts.unavailable") } : { min: 0, max: 100, now: remaining }}>
      {remaining !== null ? <View style={[styles.fill, { width: `${remaining}%`, backgroundColor: color }]} /> : null}
    </View>
    <View style={styles.reset}>
      <Ionicons name="time-outline" size={14} color={themedColor(colors.muted, 'muted')} />
      <Text style={styles.resetText}>{usage ? resetLabel(usage.resetsAt) : t("client.accounts.usageUnavailable")}</Text>
    </View>
  </View>;
}

export function AccountUsageSection({ usage, refreshing, onRefresh, onHelp }: {
  usage: UsageSummary; refreshing: boolean; onRefresh: () => void; onHelp: (window: UsageHelp) => void;
}) {
  const styles = useStyles();
  const themedColor = useThemeColor();
  useLanguage();
  return <View style={styles.section}>
    <View style={styles.heading}>
      <View style={styles.sectionIcon}><Ionicons name="stats-chart" size={17} color={themedColor(colors.muted, 'muted')} /></View>
      <Text style={styles.title}>{t("client.accounts.usage")}</Text>
      <Text style={styles.updated}>{t("client.accounts.updated")}{' '}{displayDate(usage.fetchedAt)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.accounts.refreshAccountUsage")} disabled={refreshing}
        onPress={onRefresh} style={[styles.iconButton, refreshing && styles.disabled]}>
        {refreshing ? <ActivityIndicator size="small" color={themedColor(colors.green, 'accent')} />
          : <Ionicons name="sync" size={18} color={themedColor(colors.muted, 'muted')} />}
      </Pressable>
    </View>
    <UsageMeter title={t("client.accounts.primaryUsageWindow")} usage={usage.primary} secondary={false} onHelp={() => onHelp('primary')} />
    <UsageMeter title={t("client.accounts.secondaryUsageWindow")} usage={usage.secondary} secondary onHelp={() => onHelp('secondary')} />
    {usage.error ? <Text style={styles.error}>{t("client.accounts.couldNotUpdateUsagePleaseTryAgainLater")}</Text> : null}
  </View>;
}
