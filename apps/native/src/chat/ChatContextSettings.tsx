import { displayError } from '../i18n/index';
import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { CONTEXT_CAPACITY_PRESETS_K, type ContextSettingsApi } from '../../../../shared/remote-chat/contextSettings';
import { useContextSettings } from '../../../../shared/remote-chat/client/useContextSettings';
import { useStyles } from './styles';

export function ChatContextSettings({ threadId, api, onClose }: {
  threadId: string; api: ContextSettingsApi; onClose: () => void;
}) {
  const styles = useStyles();
  const presetStyles = usePresetStyles();
  useLanguage();
  const editor = useContextSettings(threadId, api);
  const save = async () => { if (await editor.save()) onClose(); };
  return <BottomSheet visible fullWidthContent title={t("client.chat.conversationContext")} onClose={onClose}
    onBack={editor.saving ? undefined : onClose}
    dismissible={!editor.saving} actions={[
      { label: t("client.accounts.cancel"), onPress: onClose, disabled: editor.saving },
      { label: t("client.projectBrowser.save"), tone: 'primary', onPress: save, loading: editor.saving,
        disabled: editor.loading || !editor.loaded },
    ]}>
    <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.settings}>
      <Text style={styles.subtitle}>{t("client.chat.appliesToThisConversationImmediatelyAnActiveReplyWillPause")}</Text>
      {editor.loading && <ActivityIndicator accessibilityLabel={t("client.mobile.loadingContextSettings")} />}
      {editor.loaded && <>
        <Text style={styles.title}>{t("client.chat.contextCapacityKTokens")}</Text>
        <TextInput accessibilityLabel={t("client.chat.contextCapacityKTokens")} keyboardType="decimal-pad"
          value={editor.value} onChangeText={editor.setValue} editable={!editor.saving}
          placeholder={t("client.chat.selectOrEnterCapacity")} style={[styles.input, styles.questionInput]}
          onSubmitEditing={() => { void save(); }} />
        <View style={presetStyles.options}>
          {CONTEXT_CAPACITY_PRESETS_K.map((capacity) => <Pressable key={capacity}
            accessibilityRole="button" accessibilityLabel={`${capacity}K`} disabled={editor.saving}
            accessibilityState={{ selected: Number(editor.value) === capacity, disabled: editor.saving }}
            style={[styles.choice, presetStyles.option, Number(editor.value) === capacity && styles.chosen,
              editor.saving && styles.disabled]}
            onPress={() => editor.setValue(String(capacity))}>
            <Text style={styles.buttonText}>{capacity}K</Text>
          </Pressable>)}
        </View>
        <Text style={styles.subtitle}>{t("client.chat.1K1000TokensLeaveBlankToUseThe")}</Text>
        <Text style={styles.subtitle}>{t("client.chat.usageUpdatesAfterAReplySomeSpaceIsReservedSo")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.restoreDefaults")} disabled={editor.saving}
          accessibilityState={{ disabled: editor.saving }} style={styles.button} onPress={() => editor.setValue('')}>
          <Text style={styles.buttonText}>{t("client.chat.restoreDefaults")}</Text>
        </Pressable>
      </>}
      {!!editor.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(editor.error)}</Text>}
      {!editor.loading && !editor.loaded && <Pressable accessibilityRole="button" accessibilityLabel={t("client.terminal.retry")}
        style={styles.button} onPress={editor.retry}><Text style={styles.buttonText}>{t("client.terminal.retry")}</Text></Pressable>}
    </SheetScrollView>
  </BottomSheet>;
}

const usePresetStyles = createThemedStyles(() => ({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, justifyContent: 'center' },
}));
