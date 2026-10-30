import { SheetGestureScrollView as ScrollView } from '../../components/SheetScrollGesture';
import { displayError } from '../../i18n/index';
import { useThemeColor } from '../../theme/store';
import { t, useLanguage } from '../../i18n';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useEffect, useState } from 'react';
import type { GitClient } from '../../../../../shared/remote-chat/gitTypes';
import { useGitDiff, useRemoteGit } from '../../../../../shared/remote-chat/useRemoteGit';
import { useGitCommitFiles } from '../../../../../shared/remote-chat/useGitCommitFiles';
import { BottomSheet } from '../../components/BottomSheet';
import { GitHistory } from './GitHistory';
import { GitChanges } from './GitChanges';
import { GitCommitFiles } from './GitCommitFiles';
import { GitToolbar } from './GitToolbar';
import { useGitStyles as useStyles } from './styles';
import { palette } from '../styles';
import type { DownloadClient } from '../../../../../shared/remote-chat/downloads';
import { gitPatchNotice, saveGitPatch } from '../../downloads/gitPatch';
import { GitMenu, type GitMenuTarget } from './GitMenu';
import { GitFileActionConfirmation, GitRevisionConfirmation } from './GitActionConfirmations';

interface Props {
  client: GitClient; cwd: string; active: boolean; connected: boolean; onClose: () => void;
  downloads?: DownloadClient;
}

export function ChatGit(props: Props) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const panel = useRemoteGit(props);
  const [menu, setMenu] = useState<GitMenuTarget | null>(null);
  useEffect(() => { setMenu(null); }, [props.active, props.cwd, props.client]);
  const close = () => {
    if (panel.fileAction) panel.cancelFileAction();
    else if (panel.revisionAction) panel.cancelRevisionAction();
    else if (menu) setMenu(null);
    else props.onClose();
  };
  const detail = panel.detail;
  const commitFiles = useGitCommitFiles(props.client, props.cwd, detail?.commit?.hash, props.active && props.connected);
  const diff = useGitDiff(props.client, props.cwd, panel.detail, props.active && props.connected);
  const { height } = useWindowDimensions();
  const hasOverlay = Boolean(menu || panel.fileAction || panel.revisionAction);
  return <BottomSheet visible={props.active} title="Git" onClose={close}
    onBack={detail && !hasOverlay ? panel.backDetail : undefined}
    tall fullWidthContent compactHeader
    overlay={hasOverlay ? <>
      {menu && !panel.fileAction && !panel.revisionAction && <GitMenu target={menu} panel={panel}
        connected={props.connected} close={() => setMenu(null)} patchNotice={gitPatchNotice}
        onPatch={props.downloads ? commit => saveGitPatch(props.downloads!, props.cwd, commit.hash) : undefined} />}
      {panel.fileAction && <GitFileActionConfirmation panel={panel} connected={props.connected} />}
      {panel.revisionAction && <GitRevisionConfirmation panel={panel} connected={props.connected} />}
    </> : undefined}>
    <View style={{ height: height * .80, flexShrink: 1 }}>
      <GitToolbar panel={panel} connected={props.connected} />
      {!props.cwd && <Text style={styles.notice}>{t("client.git.chooseAProjectFirst")}</Text>}
      {!props.connected && <Text style={styles.notice}>{t("client.git.connectToYourComputerToUseGit")}</Text>}
      {!!panel.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(panel.error)}</Text>}
      {panel.changes?.files.some(file => file.conflict) && <Text style={styles.error}>
        {t("client.git.resolveConflictsOrFinishTheMergeOnYourComputerFirst")}</Text>}
      {!!panel.notice && <Text accessibilityRole="alert" style={styles.notice}>{panel.notice.startsWith('已提交 ')
        ? t("client.git.committed", { hash: panel.notice.slice(4) }) : displayError(panel.notice)}</Text>}
      {panel.busy && !panel.loading &&
        <ActivityIndicator style={styles.loading} color={color(palette.green, 'accent')} />}
      {detail?.kind === 'files' && <GitCommitFiles commit={detail.commit} state={commitFiles}
        connected={props.connected} onSelect={file => panel.setDetail({ kind: 'diff', path: file.path,
          commit: detail.commit, title: `${file.path} · ${detail.commit.hash.slice(0, 8)}` })} />}
      {detail?.kind === 'diff' && <>
        <Text numberOfLines={2} style={styles.detailTitle}>{detail.title}</Text>
        {!!diff.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(diff.error)}</Text>}
        {!diff.value && !diff.error && props.connected && <ActivityIndicator color={color(palette.green, 'accent')} />}
        {diff.value && <ScrollView style={styles.fill}>
          {diff.value.truncated && <Text style={styles.notice}>{t("client.git.thisDiffIsLargeOnlyPartOfItIsShown")}</Text>}
          <ScrollView horizontal><Text selectable style={styles.diff}>{diff.value.text
            ? diff.value.text.split('\n').map((line, index) => <Text key={index}
              style={line[0] === '+' ? styles.added : line[0] === '-' ? styles.removed : undefined}>
              {line}{'\n'}</Text>) : t("client.git.noTextDiffToDisplay")}</Text></ScrollView>
        </ScrollView>}
      </>}
      {!detail && <>
        <View style={styles.tabs}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: panel.tab === 'changes' }}
            style={[styles.tab, panel.tab === 'changes' && styles.selectedTab]} onPress={() => panel.setTab('changes')}>
            <Text style={[styles.tabText, panel.tab === 'changes' && styles.selectedTabText]}>
              {t("client.git.changes")}{panel.changes ? ` ${panel.changes.files.length}` : ''}</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: panel.tab === 'history' }}
            style={[styles.tab, panel.tab === 'history' && styles.selectedTab]} onPress={() => panel.setTab('history')}>
            <Text style={[styles.tabText, panel.tab === 'history' && styles.selectedTabText]}>{t("client.git.history")}</Text></Pressable>
        </View>
        {panel.loading && <View style={styles.initialLoading} accessibilityLiveRegion="polite"
          accessibilityState={{ busy: true }}>
          <ActivityIndicator color={color(palette.green, 'accent')} />
          <Text style={styles.loadingText}>
            {t(panel.tab === 'changes' ? "client.git.loadingChanges" : "client.git.loadingCommitHistory")}</Text>
        </View>}
        {!panel.loading && panel.tab === 'changes' && <GitChanges panel={panel} connected={props.connected}
          onMenu={row => setMenu({ kind: 'file', row })} />}
        {!panel.loading && panel.tab === 'history' && <GitHistory panel={panel} connected={props.connected}
          onMenu={commit => setMenu({ kind: 'commit', commit })} />}
      </>}
    </View>
  </BottomSheet>;
}
