import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { normalizeTotpSecret, parseOtpAuthUri } from './totp';
import { TotpQrScanner } from './TotpQrScanner';
import { useTotpStyles as useStyles } from './styles';
import type { TotpAlgorithm, TotpDraft, TotpEntry } from './types';

interface TotpFormSheetProps {
  entry: TotpEntry | null;
  onCancel: () => void;
  onSave: (draft: TotpDraft) => void;
  startWithScanner?: boolean;
  visible: boolean;
}

const DEFAULT_DRAFT: TotpDraft = {
  issuer: '',
  accountName: '',
  secret: '',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
};

function OptionRow<T extends string | number>({ options, selected, onChange }: {
  onChange: (value: T) => void;
  options: readonly T[];
  selected: T;
}) {
  const styles = useStyles();
  useLanguage();
  return <View style={styles.optionRow}>{options.map((value) => {
    const active = selected === value;
    return <Pressable key={value} onPress={() => onChange(value)}
      style={[styles.option, active && styles.optionActive]}>
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{value}</Text>
    </Pressable>;
  })}</View>;
}

export function TotpFormSheet({
  entry,
  onCancel,
  onSave,
  startWithScanner = false,
  visible,
}: TotpFormSheetProps) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const [draft, setDraft] = useState<TotpDraft>(DEFAULT_DRAFT);
  const [periodInput, setPeriodInput] = useState('30');
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const initial = entry ? {
      issuer: entry.issuer,
      accountName: entry.accountName,
      secret: entry.secret,
      algorithm: entry.algorithm,
      digits: entry.digits,
      period: entry.period,
    } : DEFAULT_DRAFT;
    setDraft(initial);
    setPeriodInput(String(initial.period));
    setError('');
    setShowSecret(false);
    setScannerOpen(!entry && startWithScanner);
  }, [entry, startWithScanner, visible]);

  const patchDraft = <K extends keyof TotpDraft>(key: K, value: TotpDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const applyQrValue = (value: string) => {
    setScannerOpen(false);
    try {
      const parsed = parseOtpAuthUri(value);
      setDraft(parsed);
      setPeriodInput(String(parsed.period));
      setError('');
    } catch {
      setError(t("client.mobile.noValidAuthenticatorQrCodeFoundTryAgainOrEnter"));
    }
  };

  const save = () => {
    try {
      const secret = draft.secret.trim().toLowerCase().startsWith('otpauth://')
        ? parseOtpAuthUri(draft.secret)
        : { ...draft, secret: normalizeTotpSecret(draft.secret), period: Number(periodInput) };
      if (!secret.issuer.trim() || !secret.accountName.trim()) throw new Error('missing-fields');
      if (!Number.isInteger(secret.period) || secret.period < 15 || secret.period > 120) {
        throw new Error('invalid-period');
      }
      onSave(secret);
      onCancel();
    } catch {
      setError(t("client.mobile.checkTheServiceNameAccountKeyAndRefreshPeriod"));
    }
  };

  return <>
    <BottomSheet fullWidthContent visible={visible && !scannerOpen} tall title={entry ? t("client.settings.edit2faKey") : t("client.settings.add2faKey")}
      subtitle={t("client.mobile.supportsStandardAuthenticatorKeysAndQrCodes")} onClose={onCancel}
      actions={[{ label: t("client.accounts.cancel"), onPress: onCancel }, { label: t("client.projectBrowser.save"), tone: 'primary', onPress: save }]}>
      <SheetScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled">
        {!entry ? <Pressable style={styles.qrButton} onPress={() => setScannerOpen(true)}>
          <Text style={styles.qrButtonText}>{t("client.mobile.scanQrCodeToFillIn")}</Text>
        </Pressable> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.fieldLabel}>{t("client.settings.serviceName")}</Text>
        <TextInput value={draft.issuer} onChangeText={(value) => patchDraft('issuer', value)}
          placeholder={t("client.mobile.forExampleGithub")} placeholderTextColor={color("#98a9a0", 'muted')} style={styles.input} maxLength={160} />
        <Text style={styles.fieldLabel}>{t("client.app.accounts")}</Text>
        <TextInput value={draft.accountName} onChangeText={(value) => patchDraft('accountName', value)}
          placeholder={t("client.mobile.emailOrUsername")} placeholderTextColor={color("#98a9a0", 'muted')} style={styles.input} maxLength={320} />
        <Text style={styles.fieldLabel}>{t("client.mobile.secretKey")}</Text>
        <View style={styles.secretRow}>
          <TextInput value={draft.secret} onChangeText={(value) => patchDraft('secret', value)}
            placeholder={t("client.mobile.base32KeyOrOtpauthUrl")} placeholderTextColor={color("#98a9a0", 'muted')}
            autoCapitalize="characters" autoCorrect={false} secureTextEntry={!showSecret}
            style={[styles.input, styles.secretInput]} />
          <Pressable style={styles.revealButton} onPress={() => setShowSecret((current) => !current)}>
            <Text style={styles.revealText}>{showSecret ? t("client.mobile.hide") : t("client.remoteDesktop.display")}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{t("client.mobile.keysAreKeptInYourPhoneSSecureStorageAnd")}</Text>
        <Text style={styles.fieldLabel}>{t("client.mobile.algorithm")}</Text>
        <OptionRow<TotpAlgorithm> options={['SHA1', 'SHA256', 'SHA512']} selected={draft.algorithm}
          onChange={(value) => patchDraft('algorithm', value)} />
        <Text style={styles.fieldLabel}>{t("client.mobile.codeDigits")}</Text>
        <OptionRow<6 | 8> options={[6, 8]} selected={draft.digits}
          onChange={(value) => patchDraft('digits', value)} />
        <Text style={styles.fieldLabel}>{t("client.mobile.refreshPeriodSeconds")}</Text>
        <TextInput value={periodInput} onChangeText={(value) => setPeriodInput(value.replace(/\D/g, '').slice(0, 3))}
          keyboardType="number-pad" placeholder="30" placeholderTextColor={color("#98a9a0", 'muted')} style={styles.input} />
        <Text style={styles.hint}>{t("client.mobile.choose15120SecondsUsually30")}</Text>
      </SheetScrollView>
    </BottomSheet>
    <TotpQrScanner visible={visible && scannerOpen} onClose={() => setScannerOpen(false)} onScan={applyQrValue} />
  </>;
}
