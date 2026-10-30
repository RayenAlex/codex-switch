import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetFlatList, SheetInset, SHEET_READABLE_WIDTH } from '../components/SheetScrollView';
import type { ProjectFile, ProjectFilesRequest, ProjectFilesResponse } from '../../../../shared/remote-chat/projectFiles';

interface Props {
  imagesOnly: boolean;
  threadId: string | null;
  cwd: string;
  load: (request: ProjectFilesRequest) => Promise<ProjectFilesResponse>;
  choose: (file: ProjectFile) => void;
  close: () => void;
}
export function ComposerProjectFiles({ imagesOnly, threadId, cwd, load, choose, close }: Props) {
  const fileStyles = useFileStyles();
  const color = useThemeColor();
  useLanguage();
  const [directory, setDirectory] = useState('');
  const [result, setResult] = useState<ProjectFilesResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const fileIcon = imagesOnly ? 'image' : 'file-text';
  useEffect(() => {
    let cancelled = false;
    if (!threadId && !cwd) {
      setLoading(false); setError(t("client.mobile.chooseAChatProjectBeforeAddingComputerFiles")); return;
    }
    setLoading(true); setError(''); setResult(undefined);
    void load({ threadId: threadId ?? undefined, cwd: cwd || undefined, directory, imagesOnly })
      .then((value) => { if (!cancelled) setResult(value); })
      .catch(() => { if (!cancelled) setError(t("client.mobile.couldNotLoadProjectsUpdateAndConnectYourComputerThen")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, threadId, cwd, directory, imagesOnly, revision]);
  return <BottomSheet fullWidthContent visible title={imagesOnly ? t("client.mobile.computerPhotos") : t("client.mobile.computerFiles")} subtitle={t("client.mobile.currentChatProject")}
    onClose={close}>
    <View style={fileStyles.root}>
      <SheetInset style={fileStyles.readable}>
        {result?.parent !== null && result?.parent !== undefined && <Pressable accessibilityRole="button"
          onPress={() => setDirectory(result.parent ?? '')} style={fileStyles.row}>
          <Feather name="arrow-left" size={20} /><Text style={fileStyles.name}>{t("client.downloads.goBack")}</Text>
        </Pressable>}
        {loading && <ActivityIndicator style={fileStyles.message} />}
        {!!error && <Pressable accessibilityRole="button" accessibilityLabel={t("client.mobile.retryLoadingProjectFiles")}
          onPress={() => setRevision((value) => value + 1)}><Text style={fileStyles.message}>{error}</Text></Pressable>}
      </SheetInset>
      <SheetFlatList data={result?.entries ?? []} keyExtractor={(entry) => entry.path} style={fileStyles.list}
        contentContainerStyle={fileStyles.readable}
        keyboardShouldPersistTaps="handled" nestedScrollEnabled
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.name}
          onPress={() => { if (item.directory) setDirectory(item.path); else choose(item); }}
          style={({ pressed }) => [fileStyles.row, pressed && fileStyles.pressed]}>
          <Feather name={item.directory ? 'folder' : fileIcon} size={22} color={color("#444", 'ink')} />
          <Text numberOfLines={1} style={fileStyles.name}>{item.name}</Text>
          {item.directory && <Feather name="chevron-right" size={18} color={color("#888", 'muted')} />}
        </Pressable>}
        ListEmptyComponent={!loading && !error ? <Text style={fileStyles.message}>
          {imagesOnly ? t("client.mobile.noPhotosInThisFolder") : t("client.mobile.thisFolderIsEmpty")}</Text> : null}
        ListFooterComponent={result?.truncated ? <Text style={fileStyles.message}>{t("client.downloads.onlyTheFirst500EntriesAreShown")}</Text> : null} />
    </View>
  </BottomSheet>;
}

const useFileStyles = createThemedStyles((color) => ({
  root: { flexShrink: 1, paddingBottom: 12 },
  readable: { maxWidth: SHEET_READABLE_WIDTH, width: '100%', alignSelf: 'center' },
  list: { maxHeight: 380, flexGrow: 0 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, minHeight: 48, borderRadius: 12 },
  // Leave room for Android font metrics and descenders in file and folder names.
  name: { fontSize: 15, lineHeight: 22, includeFontPadding: true, paddingVertical: 2, color: color('#222', 'ink'), flex: 1 },
  message: { fontSize: 13, lineHeight: 20, color: color('#777', 'muted'), padding: 14, maxWidth: 400 },
  pressed: { backgroundColor: color('#f3f3f3', 'canvas') },
}));
