import { displayText } from '../../i18n/index';
import { useThemeColor } from '../../theme/store';
import { t, useLanguage } from '../../i18n';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RemoteGit } from '../../../../../shared/remote-chat/useRemoteGit';
import type { GitAction } from '../../../../../shared/remote-chat/gitTypes';
import { GIT_ACTIONS, gitSyncCounts } from '../../../../../shared/remote-chat/gitActions';
import { useGitStyles as useStyles } from './styles';

const ACTION_ICONS = {
  fetch: 'download-outline', pull: 'arrow-down', update: 'swap-vertical-outline', push: 'arrow-up',
} as const;

export function GitToolbar({ panel, connected }: { panel: RemoteGit; connected: boolean }) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const [menu, setMenu] = useState<'branches' | 'actions' | null>(null);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<Exclude<GitAction, 'switch'>>('update');
  const disabled = panel.busy || !connected || !panel.changes;
  const repository = panel.repository;
  const counts = gitSyncCounts(repository);
  const branch = panel.changes?.branch ?? t("client.git.detachedHead");
  const selection = repository?.upstream ? `${branch} → ${repository.upstream}` : branch;
  const actionDisabled = disabled || !repository?.remotes.length || (action !== 'fetch' && !repository.upstream)
    || ((action === 'pull' || action === 'update') && !!panel.changes?.files.length);
  return <>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.git.switchBranch")} disabled={disabled}
        style={[styles.branchButton, disabled && styles.disabled]}
        onPress={() => setMenu(menu === 'branches' ? null : 'branches')}>
        <Ionicons name="git-branch-outline" size={16} color={color("#587267", 'muted')} />
        <Text numberOfLines={1} style={styles.branch}>{branch}</Text>
        <Ionicons name="chevron-down" size={12} color={color("#718078", 'muted')} /></Pressable>
      <View style={styles.toolbarActions}>{GIT_ACTIONS.map(item => {
        const count = counts[item.action];
        return <Pressable key={item.action} accessibilityRole="button" accessibilityLabel={displayText(item.label)}
          accessibilityHint={count !== undefined ? t("client.git.commitsToSync", { count }) : undefined}
          accessibilityState={{ expanded: menu === 'actions' && action === item.action, disabled }}
          disabled={disabled} style={[styles.toolbarAction, disabled && styles.disabled]}
          onPress={() => {
            setAction(item.action); setMenu(menu === 'actions' && action === item.action ? null : 'actions');
          }}>
          <Ionicons name={ACTION_ICONS[item.action]} size={18} color={color("#587267", 'muted')} />
          {count !== undefined && <Text style={styles.actionCount}>{count}</Text>}
        </Pressable>;
      })}
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.git.refreshGit")} disabled={disabled} style={styles.button}
        onPress={() => { panel.setDetail(null); void panel.refresh(); }}>
        <Ionicons name="refresh-outline" size={18} color={color("#587267", 'muted')} />
      </Pressable>
      </View>
    </View>
    {menu && <View style={styles.menu}>
      <View style={styles.menuHeading}><Text style={styles.areaTitle}>{menu === 'branches' ? t("client.git.switchBranch") : t("client.git.syncProject")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("client.git.closeMenu")} style={styles.button}
          onPress={() => setMenu(null)}><Text style={styles.buttonText}>{t("client.projectBrowser.close")}</Text></Pressable></View>
      <ScrollView style={styles.menuScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {menu === 'branches' ? <>
          <TextInput accessibilityLabel={t("client.git.searchBranches")} placeholder={t("client.git.searchBranches")} style={styles.search}
            value={query} onChangeText={setQuery} />
          {repository?.branches.filter(branch => branch.name.includes(query)).map(branch => {
            const current = !branch.remote && branch.name === panel.changes?.branch;
            return <Pressable key={branch.ref} accessibilityRole="button" accessibilityLabel={t("client.mobile.switchTo", { value1: branch.name })}
              disabled={disabled || branch.occupied || current} style={styles.branchRow}
              onPress={() => { setMenu(null); void panel.action('switch', branch.ref); }}>
              <Text style={[styles.path, (branch.occupied || current) && styles.disabled]}>{branch.name}</Text>
              <Text style={styles.meta}>{branch.occupied ? t("client.git.usedByAnotherWorktree") : branch.remote ? t("client.git.remote") : t("client.git.local")}
                {current ? ' ✓' : ''}</Text></Pressable>;
          })}
          <Text style={styles.menuHint}>{t("client.git.currentSelection", { branch: selection })}</Text>
        </> : <>
          <Text style={styles.areaTitle}>{displayText(GIT_ACTIONS.find(item => item.action === action)!.label)}</Text>
          <Text style={styles.menuHint}>{displayText(GIT_ACTIONS.find(item => item.action === action)!.hint)}</Text>
          <Text style={styles.menuHint}>{t("client.mobile.currentBranch")}{panel.changes?.branch ?? 'HEAD'}{'\n'}
            {t("client.mobile.upstreamBranch")}{repository?.upstream ?? t("client.accounts.notSet")}</Text>
          {action === 'pull' && <>
            <View style={styles.actionOptions}>{(['merge', 'rebase'] as const).map(strategy =>
              <Pressable key={strategy} accessibilityRole="button"
                accessibilityState={{ selected: panel.strategy === strategy }}
                style={[styles.actionButton, panel.strategy === strategy && styles.activeMode]}
                onPress={() => panel.setStrategy(strategy)}><Text style={styles.buttonText}>
                  {strategy === 'merge' ? t("client.git.merge") : t("client.git.rebase")}</Text></Pressable>)}</View>
          </>}
          {(action === 'pull' || action === 'update') && !!panel.changes?.files.length
            && <Text style={styles.menuHint}>{t("client.git.commitLocalChangesBeforePullingOrUpdatingTheProject")}</Text>}
          {!repository?.remotes.length && <Text style={styles.menuHint}>{t("client.git.addARemoteRepositoryOnYourComputerFirst")}</Text>}
          <Pressable accessibilityRole="button" disabled={actionDisabled}
            style={[styles.submit, { marginTop: 10 }, actionDisabled && styles.disabled]}
            onPress={() => { setMenu(null); void panel.action(action); }}>
            <Text style={styles.submitText}>{t("client.mobile.run")}{' '}{displayText(GIT_ACTIONS.find(item => item.action === action)!.label)}</Text>
          </Pressable>
        </>}
      </ScrollView>
    </View>}
  </>;
}
