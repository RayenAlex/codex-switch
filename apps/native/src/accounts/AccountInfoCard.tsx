import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { AccountSummary } from '../types';
import { earliestExpirationDate } from '../utils/expiration';
import { copyAccountValue } from './copyAccountValue';
import { detailColors as colors, useDetailStyles as useStyles } from './detailStyles';
import { useAccountTotp } from './useAccountTotp';
import type { ResetCreditsState } from './useResetCredits';

function InfoRow({ label, value, secret = false, copy = false }: {
  label: string; value?: string | null; secret?: boolean; copy?: boolean;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const [revealed, setRevealed] = useState(false);
  const hidden = secret && !revealed;
  const text = value ? (hidden ? '••••••••' : value) : t("client.accounts.notSet");
  return <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text selectable={!hidden} style={[styles.value, !value && styles.emptyValue]}>{text}</Text>
    {secret && value ? <Pressable accessibilityRole="button"
      accessibilityLabel={`${hidden ? t("client.remoteDesktop.display") : t("client.mobile.hide")}${label}`} onPress={() => setRevealed(!revealed)}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={17} color={color(colors.muted, 'muted')} />
    </Pressable> : null}
    {copy && value ? <Pressable accessibilityRole="button" accessibilityLabel={t("client.accounts.copy", { value1: label })}
      onPress={() => void copyAccountValue(label, value)}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons name="copy-outline" size={17} color={color(colors.muted, 'muted')} />
    </Pressable> : null}
  </View>;
}

function TotpRow({ secret, active }: { secret: string; active: boolean }) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const totp = useAccountTotp(active ? secret : '');
  return <View style={styles.row}>
    <Text style={styles.label}>2FA</Text>
    <View style={styles.spacer}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.accounts.copyCurrentCode")} disabled={!totp}
        onPress={() => { if (totp) void copyAccountValue(t("client.accounts.verificationCode"), totp.code); }} style={styles.codeButton}>
        <Text style={totp ? styles.code : styles.emptyCode}>
          {secret ? (totp?.code ?? t("client.accounts.unavailable")) : t("client.accounts.notSet")}
        </Text>
        {totp ? <Ionicons name="copy-outline" size={17} color={color(colors.muted, 'muted')} /> : null}
      </Pressable>
    </View>
    {totp ? <Text style={styles.countdown}>{totp.remaining}{' '}{t("client.accounts.s")}</Text> : null}
  </View>;
}

function CreditsRow({ credits, onPress }: { credits: ResetCreditsState; onPress: () => void }) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const count = credits.summary?.credits.length;
  return <Pressable accessibilityRole="button" accessibilityLabel={t("client.accounts.viewResetCredits")} onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <Text style={styles.label}>{t("client.accounts.resetCredits")}</Text>
    {credits.loading ? <View style={styles.value}><ActivityIndicator size="small" color={color(colors.green, 'accent')} /></View>
      : <Text style={styles.value}>{count === undefined ? t("client.accounts.unavailable") : t("client.accounts.credits", { value1: count })}</Text>}
    <Ionicons name="chevron-forward" size={16} color={color(colors.muted, 'muted')} />
  </Pressable>;
}

export function AccountInfoCard({ account, credits, active, onEdit, onNote, onCredits }: {
  account: AccountSummary;
  credits: ResetCreditsState;
  active: boolean;
  onEdit: () => void;
  onNote: () => void;
  onCredits: () => void;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const details = account.privateDetails;
  const expiration = earliestExpirationDate(account.expiresAt, account.usage.apiExpiresAt);
  return <View style={styles.section}>
    <View style={styles.heading}>
      <View style={styles.sectionIcon}><Ionicons name="person" size={17} color={color(colors.muted, 'muted')} /></View>
      <Text style={styles.title}>{t("client.accounts.accountInformation")}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.accounts.editAccountInformation")} onPress={onEdit}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Ionicons name="create-outline" size={21} color={color(colors.green, 'accent')} />
      </Pressable>
    </View>
    <InfoRow label={t("client.accounts.plan")} value={account.plan || 'ChatGPT'} />
    <InfoRow label={t("client.accounts.expires")} value={expiration} />
    {account.expiresAt && expiration !== account.expiresAt
      ? <InfoRow label={t("client.accounts.presetEndDate")} value={account.expiresAt} /> : null}
    <InfoRow label={t("client.accounts.accountId")} value={account.accountId} copy />
    <InfoRow label={t("client.accounts.phoneNumber")} value={details?.phoneNumber} copy />
    <InfoRow label={t("client.accounts.password")} value={details?.password} secret copy />
    <TotpRow secret={details?.totpSecret ?? ''} active={active} />
    <Pressable accessibilityRole="button" accessibilityLabel={t("client.accounts.viewFullNote")} onPress={onNote}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={styles.label}>{t("client.accounts.notes")}</Text>
      <Text style={styles.value} numberOfLines={1} ellipsizeMode="tail">{account.note || t("client.accounts.notSet")}</Text>
      <Ionicons name="chevron-forward" size={16} color={color(colors.muted, 'muted')} />
    </Pressable>
    <CreditsRow credits={credits} onPress={onCredits} />
  </View>;
}
