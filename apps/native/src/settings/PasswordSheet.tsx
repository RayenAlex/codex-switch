import { SheetGestureScrollView as ScrollView } from '../components/SheetScrollGesture';
import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { changePassword } from '../api/client';
import { Toast } from '../components/AppToast';
import { BottomSheet } from '../components/BottomSheet';
import type { AuthSession } from '../types';
import { useStyles } from './styles';

export function PasswordSheet({ session, onClose }: { session: AuthSession; onClose: () => void }) {
  const styles = useStyles();
  useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (saving) return;
    if (currentPassword.length < 6) return setError(t("client.mobile.theCurrentPasswordMustHaveAtLeast6Characters"));
    if (newPassword.length < 8) return setError(t("client.mobile.theNewPasswordMustHaveAtLeast8Characters"));
    if (newPassword !== confirmPassword) return setError(t("client.settings.theNewPasswordsDoNotMatch"));
    setSaving(true);
    setError('');
    try {
      await changePassword(session, currentPassword, newPassword);
      Toast.success(t("client.mobile.passwordChangedUseYourNewPasswordNextTime"));
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("client.mobile.couldNotUpdateTryAgainLater"));
    } finally {
      setSaving(false);
    }
  };
  return <BottomSheet visible title={t("client.settings.changePassword")} subtitle={t("client.mobile.verifyYourCurrentPasswordToSetANewOne")}
    onClose={onClose} dismissible={!saving} tall actions={[
      { label: t("client.accounts.cancel"), onPress: onClose, disabled: saving },
      { label: t("client.settings.changePassword.4c62c9"), tone: 'primary', onPress: submit, loading: saving },
    ]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
      <Text style={styles.detailLabel}>{t("client.settings.currentPassword")}</Text>
      <TextInput accessibilityLabel={t("client.settings.currentPassword")} value={currentPassword} onChangeText={setCurrentPassword}
        secureTextEntry autoComplete="current-password" placeholder={t("client.mobile.enterCurrentPassword")}
        style={styles.input} editable={!saving} />
      <Text style={styles.detailLabel}>{t("client.settings.newPassword")}</Text>
      <TextInput accessibilityLabel={t("client.settings.newPassword")} value={newPassword} onChangeText={setNewPassword}
        secureTextEntry autoComplete="new-password" placeholder={t("client.mobile.atLeast8Characters")}
        style={styles.input} editable={!saving} />
      <Text style={styles.detailLabel}>{t("client.settings.confirmNewPassword")}</Text>
      <TextInput accessibilityLabel={t("client.settings.confirmNewPassword")} value={confirmPassword} onChangeText={setConfirmPassword}
        secureTextEntry autoComplete="new-password" placeholder={t("client.mobile.enterTheNewPasswordAgain")}
        style={styles.input} editable={!saving} onSubmitEditing={() => void submit()} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </BottomSheet>;
}
