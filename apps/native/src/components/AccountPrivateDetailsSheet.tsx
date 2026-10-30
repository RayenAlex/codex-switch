import { displayError } from '../i18n/index';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { updateAccountDetails } from '../api/client';
import { normalizeTotpSecret, parseOtpAuthUri } from '../totp/totp';
import { TotpQrScanner } from '../totp/TotpQrScanner';
import type { AccountSummary, AuthSession } from '../types';
import { BottomSheet } from './BottomSheet';
import { SheetScrollView } from './SheetScrollView';
import { Toast } from './AppToast';
import { useAccountTotp } from '../accounts/useAccountTotp';
import { copyAccountValue as copyValue } from '../accounts/copyAccountValue';

function messageOf(error: unknown) {
  return error instanceof Error ? displayError(error.message) : t("client.mobile.couldNotSaveTryAgainLater");
}

function normalizeAccountTotp(value: string) {
  if (!value.trim()) return '';
  return value.trim().toLowerCase().startsWith('otpauth://')
    ? parseOtpAuthUri(value).secret
    : normalizeTotpSecret(value);
}

function validExpirationDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function SecretInputRow({ label, value, onChangeText, hidden, onToggle, maxLength }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hidden: boolean;
  onToggle: () => void;
  maxLength: number;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  return <View>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputRow}>
      <TextInput value={value} onChangeText={onChangeText} secureTextEntry={hidden}
        autoCapitalize="none" autoCorrect={false} maxLength={maxLength}
        placeholder={t("client.accounts.notSet")} placeholderTextColor={color("#98a69f", 'muted')} style={[styles.input, styles.flexInput]} />
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.textButton}>
        <Text style={styles.textButtonLabel}>{hidden ? t("client.remoteDesktop.display") : t("client.mobile.hide")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={!value} onPress={() => void copyValue(label, value)}
        style={[styles.copyButton, !value && styles.disabled]}>
        <Text style={styles.copyButtonLabel}>{t("client.projectBrowser.copied")}</Text>
      </Pressable>
    </View>
  </View>;
}

function AccountTotpPreview({ secret }: { secret: string }) {
  const styles = useStyles();
  useLanguage();
  const totp = useAccountTotp(secret);
  if (!totp) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={t("client.accounts.copyCurrentCode")}
    onPress={() => void copyValue(t("client.accounts.verificationCode"), totp.code)} style={styles.totpPreview}>
    <View>
      <Text style={styles.totpCaption}>{t("client.mobile.currentCodeTapToCopy")}</Text>
      <Text style={styles.totpCode}>{totp.code.slice(0, 3)} {totp.code.slice(3)}</Text>
    </View>
    <View style={styles.countdownBadge}><Text style={styles.countdownText}>{totp.remaining}</Text></View>
  </Pressable>;
}

export function AccountPrivateDetailsSheet({ account, session, syncing, onClose, onUpdated }: {
  account: AccountSummary | null;
  session: AuthSession;
  syncing: boolean;
  onClose: () => void;
  onUpdated: (account: AccountSummary) => void;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [previewSecret, setPreviewSecret] = useState('');
  const [passwordHidden, setPasswordHidden] = useState(true);
  const [totpHidden, setTotpHidden] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [totpError, setTotpError] = useState('');
  const [saving, setSaving] = useState(false);
  const metadataEditable = account?.metadataEditable !== false;

  const privateDetails = account?.privateDetails;

  useEffect(() => {
    setNote(account?.note ?? '');
    setExpiresAt(account?.expiresAt ?? '');
    setPhoneNumber(privateDetails?.phoneNumber ?? '');
    setPassword(privateDetails?.password ?? '');
    setTotpSecret(privateDetails?.totpSecret ?? '');
    setPreviewSecret(privateDetails?.totpSecret ?? '');
    setPasswordHidden(true);
    setTotpHidden(true);
    setTotpError('');
  }, [
    account?.expiresAt,
    account?.id,
    account?.note,
    privateDetails?.password,
    privateDetails?.phoneNumber,
    privateDetails?.totpSecret,
  ]);

  const previewTotp = () => {
    try {
      const secret = normalizeAccountTotp(totpSecret);
      setTotpSecret(secret);
      setPreviewSecret(secret);
      setTotpError('');
    } catch {
      setPreviewSecret('');
      setTotpError(t("client.settings.invalid2faKeyFormat"));
    }
  };

  const save = async () => {
    if (!account || saving) return;
    if (!validExpirationDate(expiresAt)) {
      Toast.fail(t("client.mobile.useYyyyMmDdForTheExpirationDate"));
      return;
    }
    let normalizedTotpSecret = '';
    try { normalizedTotpSecret = normalizeAccountTotp(totpSecret); }
    catch { setTotpError(t("client.settings.invalid2faKeyFormat")); return; }
    setSaving(true);
    try {
      const updated = await updateAccountDetails(session, account.id, {
        note,
        expiresAt,
        privateDetails: { password, phoneNumber: phoneNumber.trim(), totpSecret: normalizedTotpSecret },
      });
      onUpdated(updated);
      Toast.success(t("client.app.accountInformationSaved"));
      onClose();
    } catch (error) {
      Toast.fail(messageOf(error));
    } finally {
      setSaving(false);
    }
  };

  return <>
    <BottomSheet fullWidthContent visible={Boolean(account) && !scannerOpen}
      tall title={t("client.accounts.editAccountInformation")} subtitle={account?.email}
      onClose={onClose} dismissible={!saving} actions={[
        { label: t("client.accounts.cancel"), onPress: onClose, disabled: saving },
        {
          label: t("client.projectBrowser.save"),
          tone: 'primary',
          onPress: () => void save(),
          disabled: syncing,
          loading: saving,
        },
      ]}>
      {syncing ? <View style={styles.syncingBox}>
        <ActivityIndicator color={color("#14806f", 'accent')} />
        <Text style={styles.syncingText}>{t("client.mobile.syncingAccountDetails")}</Text>
      </View> : <SheetScrollView style={styles.scroll} contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t("client.mobile.setAnExpirationDate")}</Text>
        <TextInput value={expiresAt} onChangeText={setExpiresAt} editable={metadataEditable}
          placeholder="YYYY-MM-DD" placeholderTextColor={color("#98a69f", 'muted')} maxLength={10} style={styles.input} />
        {!metadataEditable ? <Text style={styles.readOnlyHint}>{t("client.mobile.thisFieldIsManagedByAnAdministrator")}</Text> : null}

        <Text style={styles.label}>{t("client.accounts.phoneNumber")}</Text>
        <View style={styles.inputRow}>
          <TextInput value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad"
            placeholder={t("client.accounts.notSet")} placeholderTextColor={color("#98a69f", 'muted')} maxLength={64}
            style={[styles.input, styles.flexInput]} />
          <Pressable accessibilityRole="button" disabled={!phoneNumber}
            onPress={() => void copyValue(t("client.accounts.phoneNumber"), phoneNumber)}
            style={[styles.copyButton, !phoneNumber && styles.disabled]}>
            <Text style={styles.copyButtonLabel}>{t("client.projectBrowser.copied")}</Text>
          </Pressable>
        </View>

        <SecretInputRow label={t("client.accounts.password")} value={password} onChangeText={setPassword}
          hidden={passwordHidden} onToggle={() => setPasswordHidden((value) => !value)} maxLength={1024} />

        <Text style={styles.label}>{t("client.mobile.link2faToAccount")}</Text>
        <View style={styles.inputRow}>
          <TextInput value={totpSecret} onChangeText={(value) => {
            setTotpSecret(value);
            setPreviewSecret('');
            setTotpError('');
          }} onBlur={previewTotp} secureTextEntry={totpHidden} autoCapitalize="characters"
            autoCorrect={false} placeholder={t("client.mobile.base32Key")} placeholderTextColor={color("#98a69f", 'muted')}
            maxLength={512} style={[styles.input, styles.flexInput]} />
          <Pressable onPress={() => setTotpHidden((value) => !value)} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>{totpHidden ? t("client.remoteDesktop.display") : t("client.mobile.hide")}</Text>
          </Pressable>
          <Pressable onPress={() => setScannerOpen(true)} style={styles.scanButton}>
            <Text style={styles.scanButtonText}>{t("client.mobile.scanQrCode")}</Text>
          </Pressable>
        </View>
        {totpError ? <Text style={styles.errorText}>{totpError}</Text> : null}
        <AccountTotpPreview secret={previewSecret} />

        <Text style={styles.label}>{t("client.accounts.notes")}</Text>
        <TextInput value={note} onChangeText={setNote} editable={metadataEditable} multiline
          textAlignVertical="top" placeholder={t("client.mobile.addAccountNote")} placeholderTextColor={color("#98a69f", 'muted')}
          style={[styles.input, styles.noteInput]} />
        {!metadataEditable ? <Text style={styles.readOnlyHint}>{t("client.mobile.thisFieldIsManagedByAnAdministrator")}</Text> : null}
      </SheetScrollView>}
    </BottomSheet>
    <TotpQrScanner visible={Boolean(account) && scannerOpen} onClose={() => setScannerOpen(false)}
      onScan={(value) => {
        try {
          const secret = parseOtpAuthUri(value).secret;
          setTotpSecret(secret);
          setPreviewSecret(secret);
          setTotpError('');
        } catch {
          setTotpError(t("client.mobile.noValidAuthenticatorQrCodeFound"));
        } finally {
          setScannerOpen(false);
        }
      }} />
  </>;
}

const useStyles = createThemedStyles((color) => ({
  scroll: { maxHeight: 620 },
  content: { paddingBottom: 10 },
  syncingBox: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  syncingText: { color: color('#568072', 'accent'), fontSize: 12, fontWeight: '700' },
  label: { color: color('#263b31', 'ink'), fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 7 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: color('#cbdcd0', 'border'),
    borderRadius: 10,
    backgroundColor: color('#fbfdfb', 'surface'),
    color: color('#13231c', 'ink'),
    fontSize: 14,
    paddingHorizontal: 12,
  },
  flexInput: { flex: 1 },
  noteInput: { minHeight: 110, paddingTop: 12 },
  textButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 4 },
  textButtonLabel: { color: color('#14806f', 'accent'), fontSize: 11, fontWeight: '800' },
  copyButton: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, backgroundColor: color('#e6f8f1', 'canvas') },
  copyButtonLabel: { color: color('#0b8065', 'accent'), fontSize: 11, fontWeight: '800' },
  scanButton: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, backgroundColor: color('#e8f8fb', 'canvas') },
  scanButtonText: { color: color('#168da2', 'info'), fontSize: 11, fontWeight: '800' },
  readOnlyHint: { color: color('#8a9891', 'muted'), fontSize: 10, marginTop: 5 },
  errorText: { color: color('#bd3c35', 'danger'), fontSize: 11, marginTop: 6 },
  totpPreview: {
    minHeight: 82,
    marginTop: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: color('#bde8d8', 'border'),
    borderRadius: 14,
    backgroundColor: color('#eaf9f4', 'canvas'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totpCaption: { color: color('#568072', 'accent'), fontSize: 11, fontWeight: '700' },
  totpCode: { color: color('#0b8065', 'accent'), fontSize: 26, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  countdownBadge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: color('#18af8c', 'accent'),
    borderRadius: 22,
    backgroundColor: color('#fff', 'surface'),
  },
  countdownText: { color: color('#0b8065', 'accent'), fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.42 },
}));
