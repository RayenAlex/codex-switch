import { displayError } from '../i18n/index';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetFlatList, SheetInset, SHEET_READABLE_WIDTH } from '../components/SheetScrollView';
import { directoryProject, type ProjectPickerProps } from '../../../../shared/remote-chat/projectDirectories';
import { useProjectDirectories } from '../../../../shared/remote-chat/client/useProjectDirectories';

export function ChatProjectPicker(props: ProjectPickerProps) {
  const pickerStyles = usePickerStyles();
  const color = useThemeColor();
  useLanguage();
  const { result, loading, error, browse, retry } = useProjectDirectories(props);
  return <BottomSheet fullWidthContent visible title={props.title ?? t("client.chat.chooseProject")} onClose={props.close}
    actions={[{ label: t("client.chat.chooseThisFolder"), tone: 'primary', disabled: loading || !result?.directory,
      onPress: () => { if (result?.directory) props.choose(directoryProject(result.directory)); } }]}>
    <View style={pickerStyles.root}>
      <SheetInset style={pickerStyles.readable}>
        <Text numberOfLines={2} style={pickerStyles.message}>{result?.directory || t("client.downloads.thisComputer")}</Text>
        <View style={pickerStyles.navigation}>
          <Pressable accessibilityRole="button" disabled={loading} onPress={() => browse('')}>
            <Text style={pickerStyles.link}>{t("client.downloads.thisComputer")}</Text></Pressable>
          {result?.parent != null && <Pressable accessibilityRole="button" disabled={loading}
            onPress={() => browse(result.parent ?? '')}><Text style={pickerStyles.link}>{t("client.downloads.goBack")}</Text></Pressable>}
        </View>
        {loading && <ActivityIndicator accessibilityLabel={t("client.mobile.loadingFolder")} style={pickerStyles.message} />}
        {!!error && <View><Text accessibilityRole="alert" style={pickerStyles.message}>{displayError(error)}</Text>
          <Pressable accessibilityRole="button" onPress={retry}><Text style={pickerStyles.link}>{t("client.terminal.retry")}</Text></Pressable>
        </View>}
      </SheetInset>
      <SheetFlatList data={result?.entries ?? []} keyExtractor={(entry) => entry.path} style={pickerStyles.list}
        contentContainerStyle={pickerStyles.readable}
        keyboardShouldPersistTaps="handled" nestedScrollEnabled
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.name}
          disabled={loading} onPress={() => browse(item.path)} style={pickerStyles.row}>
          <Feather name="folder" size={21} color={color("#6f8177", 'muted')} />
          <Text numberOfLines={1} style={pickerStyles.name}>{item.name}</Text>
          <Feather name="chevron-right" size={18} color={color("#6f8177", 'muted')} />
        </Pressable>}
        ListEmptyComponent={!loading && !error ? <Text style={pickerStyles.message}>{t("client.chat.noSubfoldersHere")}</Text> : null}
        ListFooterComponent={result?.truncated
          ? <Text style={pickerStyles.message}>{t("client.chat.onlySomeFoldersAreShown")}</Text> : null} />
    </View>
  </BottomSheet>;
}

const usePickerStyles = createThemedStyles((color) => ({
  root: { flexShrink: 1 },
  readable: { width: '100%', maxWidth: SHEET_READABLE_WIDTH, alignSelf: 'center' },
  list: { maxHeight: 340, flexGrow: 0 },
  navigation: { flexDirection: 'row', gap: 16 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, minHeight: 48 },
  // Leave room for Android font metrics and descenders when truncating to one line.
  name: { flex: 1, color: color('#13231c', 'ink'), fontSize: 15, lineHeight: 22,
    includeFontPadding: true, paddingVertical: 2 },
  message: { color: color('#6f8177', 'muted'), fontSize: 13, lineHeight: 20, padding: 12 },
  link: { color: color('#14806f', 'accent'), fontSize: 13, lineHeight: 20, includeFontPadding: true, padding: 12 },
}));
