import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Toast } from '../components/AppToast';
import { BottomSheet } from '../components/BottomSheet';
import { useStyles } from './styles';

const MIN_REFRESH_MINUTES = 1;
const MAX_REFRESH_MINUTES = 1440;

interface RefreshIntervalSheetProps {
  minutes: number;
  onSave: (minutes: number) => Promise<void>;
  onClose: () => void;
}

export function RefreshIntervalSheet({ minutes, onSave, onClose }: RefreshIntervalSheetProps) {
  const styles = useStyles();
  useLanguage();
  const [input, setInput] = useState(String(minutes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (saving) return;
    const nextMinutes = Number(input);
    if (!Number.isInteger(nextMinutes) || nextMinutes < MIN_REFRESH_MINUTES || nextMinutes > MAX_REFRESH_MINUTES) {
      setError(t("client.settings.enterAWholeNumberFrom1To1440Minutes"));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(nextMinutes);
      Toast.success(t("client.settings.usageWillRefreshEveryMinutes", { value1: nextMinutes }));
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("client.mobile.couldNotSaveTryAgainLater"));
    } finally {
      setSaving(false);
    }
  };
  return <BottomSheet visible title={t("client.settings.autoRefreshUsage")} onClose={onClose} dismissible={!saving}
    actions={[
      { label: t("client.accounts.cancel"), onPress: onClose, disabled: saving },
      { label: t("client.projectBrowser.save"), tone: 'primary', onPress: save, loading: saving },
    ]}>
    <View style={styles.sheetBody}>
      <Text style={styles.hint}>{t("client.settings.refreshAllAccountUsageAutomaticallyYouCanAlsoRefreshManually")}</Text>
      <Text style={styles.detailLabel}>{t("client.settings.refreshIntervalMinutes")}</Text>
      <TextInput accessibilityLabel={t("client.settings.refreshIntervalMinutes")} value={input}
        onChangeText={(value) => setInput(value.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad" placeholder="30" style={styles.input} editable={!saving}
        onSubmitEditing={() => void save()} />
      <Text style={styles.hint}>{t("client.settings.choose11440MinutesTheDefaultIs30Minutes")}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  </BottomSheet>;
}
