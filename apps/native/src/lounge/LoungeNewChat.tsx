import { accountName } from '../../../../shared/lounge/names';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useNewLoungeChat, type NewLoungeChatOptions } from '../../../../shared/lounge/useNewLoungeChat';
import { displayText, t } from '../i18n';
import { LoungeAvatar } from './LoungeMessage';
import { LoungeSheet } from './LoungeSheet';
import { useLoungeStyles } from './styles';
import { useLoungeColor } from './theme';

export function LoungeNewChat(props: NewLoungeChatOptions) {
  const model = useNewLoungeChat(props);
  const styles = useLoungeStyles();
  const color = useLoungeColor();
  const submitColor = color('#fff', 'canvas');
  const disabled = !model.query.trim() || model.busy || !model.available;
  return <LoungeSheet title={t('client.lounge.newChat')} close={model.cancel} keyboardAware>
    <View style={styles.newChatContent}>
      <Text style={styles.muted}>{t('client.lounge.accountLookupHint')}</Text>
      <TextInput value={model.query} onChangeText={model.setQuery} style={[styles.field, styles.newChatInput]}
        accessibilityLabel={t('client.lounge.accountLookupLabel')} placeholder={t('client.lounge.accountLookupLabel')}
        placeholderTextColor={color('#687c89', 'muted')} maxLength={320} editable={!model.busy}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off"
        returnKeyType="go" blurOnSubmit={false} onSubmitEditing={() => void model.submit()} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.directChat')}
        accessibilityState={{ disabled, busy: model.busy }} disabled={disabled}
        style={[styles.button, disabled && styles.disabled]} onPress={() => void model.submit()}>
        {model.busy ? <ActivityIndicator color={submitColor} />
          : <Text style={[styles.buttonText, { color: submitColor }]}>{t('client.lounge.directChat')}</Text>}
      </Pressable>
      {!model.available && <Text style={styles.muted}>{t('client.lounge.accountLookupFailed')}</Text>}
      {!!model.error && <Text accessibilityRole="alert" style={styles.error}>{displayText(model.error)}</Text>}
      <Text accessibilityRole="header" style={styles.rowTitle}>{t('client.lounge.recentSpeakers')}</Text>
      {!model.speakers.length && <Text style={styles.muted}>{t('client.lounge.noRecentSpeakers')}</Text>}
    </View>
    {model.speakers.map(user => <Pressable key={user.id} accessibilityRole="button" style={styles.chatRow}
      accessibilityLabel={t('client.lounge.directWith', { account: accountName(user) })} onPress={() => model.open(user)}>
      <LoungeAvatar user={user} /><Text style={[styles.rowTitle, styles.heading]}>{accountName(user)}</Text>
    </Pressable>)}
  </LoungeSheet>;
}
