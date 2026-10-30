import { accountName, accountMatches } from '../../../../shared/lounge/names';
import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LoungeController } from '../../../../shared/lounge/controller';
import type { MobileLounge } from '../../../../shared/lounge/useMobileLounge';
import { conversationRows, type ConversationRow } from '../../../../shared/lounge/conversationRows';
import { contactStatus } from '../../../../shared/lounge/contacts';
import { t } from '../i18n';
import { LoungeAvatar } from './LoungeMessage';
import { LoungeSheet } from './LoungeSheet';
import { useLoungeStyles } from './styles';
import { useLoungeColor } from './theme';
import { LoungeChatRow } from './LoungeChatRow';
import { LoungeChatActions } from './LoungeChatActions';

export function LoungeChats({ model, controller, onBack }: {
  model: MobileLounge; controller: LoungeController; onBack: () => void;
}) {
  const styles = useLoungeStyles();
  const color = useLoungeColor();
  const [query, setQuery] = useState('');
  const [actions, setActions] = useState<ConversationRow>();
  const rows = conversationRows({ state: model.state, controller, drafts: model.drafts }).filter(row =>
    row.user ? accountMatches(row.user, query)
      : t('client.lounge.groupChat').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const actionRow = actions && rows.find(row => row.id === actions.id);
  return <View style={styles.page}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.discovery.back')}
        style={styles.iconButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={22} color={color('#202b33', 'ink')} /></Pressable>
      <Text accessibilityRole="header" style={[styles.title, styles.heading]}>{t('client.lounge.chats')}</Text>
      {model.state.user && <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.profile')}
        style={styles.iconButton} onPress={() => model.setProfile(model.state.user)}>
        <Ionicons name="person-circle-outline" size={22} color={color('#456c96', 'info')} /></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.newChat')}
        disabled={!model.state.directAvailable} accessibilityState={{ disabled: !model.state.directAvailable }}
        style={[styles.newChatButton, !model.state.directAvailable && styles.disabled]}
        onPress={() => model.setSheet('new-chat')}>
        <Ionicons name="add" size={18} color={color('#456c96', 'info')} />
        <Text style={styles.chatsLabel}>{t('client.lounge.newChat')}</Text></Pressable>
    </View>
    <View style={styles.search}><Ionicons name="search" size={18} color={color('#687c89', 'muted')} />
      <TextInput value={query} onChangeText={setQuery} style={styles.searchInput}
        accessibilityLabel={t('client.lounge.searchChats')} placeholder={t('client.lounge.searchChats')}
        placeholderTextColor={color('#687c89', 'muted')} /></View>
    {model.notifications.error && <Text accessibilityRole="alert" style={[styles.error, styles.notice]}>
      {t('client.lounge.notificationSaveFailed')}</Text>}
    <FlatList data={rows} keyExtractor={row => row.id} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 12 }}
      ListEmptyComponent={<Text style={styles.muted}>{t('client.lounge.noChats')}</Text>}
      renderItem={({ item, index }) => <>
        {(index === 0 || !rows[index - 1].user) && <Text style={styles.sectionLabel}>
          {t(item.user ? 'client.lounge.privateChats' : 'client.lounge.publicRoom')}</Text>}
        <LoungeChatRow row={item} model={model} actions={() => setActions(item)} />
      </>} />
    {actionRow && <LoungeChatActions row={actionRow} model={model} controller={controller}
      close={() => setActions(undefined)} />}
  </View>;
}

export function LoungeMembers({ model }: { model: MobileLounge }) {
  const styles = useLoungeStyles();
  const members = model.state.contacts.filter(contact => contact.user.id !== model.state.user?.id);
  return <LoungeSheet title={t('client.lounge.members')} close={() => model.setSheet(undefined)}>
    <Text style={styles.muted}>{t('client.lounge.membersHint')}</Text>
    {!members.length && <Text style={styles.muted}>{t('client.lounge.noMembers')}</Text>}
    {members.map(contact => <Pressable key={contact.user.id} accessibilityRole="button"
      accessibilityLabel={t('client.lounge.viewProfile', { account: accountName(contact.user) })}
      style={styles.chatRow} onPress={() => model.setProfile(contact.user)}>
      <LoungeAvatar user={contact.user} /><View style={styles.heading}>
        <Text style={styles.rowTitle}>{accountName(contact.user)}</Text>
        {contact.direct && <Text style={styles.muted}>{t(contactStatus(contact))}</Text>}</View>
      <Text style={styles.chatsLabel}>{t('client.lounge.profile')}</Text>
    </Pressable>)}
  </LoungeSheet>;
}
