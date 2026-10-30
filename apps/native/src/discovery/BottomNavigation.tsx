import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { primaryNavigationPage } from '../../../../shared/navigation/discovery';
import { DownloadCountIcon } from '../downloads/DownloadCountIcon';
import { t, useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { LoungeUnread } from '../lounge/LoungeMessage';

export function BottomNavigation({ activePage, owner, loungeUnread = 0, onChange }: {
  activePage: string;
  owner?: string;
  loungeUnread?: number;
  onChange: (page: 'chat' | 'accounts' | 'discover' | 'settings') => void;
}) {
  const resolveThemeColor = useThemeColor();
  const styles = useStyles();
  useLanguage();
  const settingsActive = ['admin', 'about', 'settings'].includes(activePage);
  const discoveryActive = primaryNavigationPage(activePage) === 'discover';
  // Keep the home-indicator area inside the navigation background.
  return <SafeAreaView edges={['bottom']} style={styles.bottomNavigation} accessibilityRole="tablist">
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: activePage === 'chat' }}
      onPress={() => onChange('chat')} style={styles.navItem}>
      <Ionicons name="chatbubble-outline" size={23}
        color={activePage === 'chat' ? resolveThemeColor('#00c98b', 'accent') : resolveThemeColor('#858991', 'muted')} />
      <Text style={[styles.navText, activePage === 'chat' && styles.navTextActive]}>{t("client.app.chat")}</Text>
    </Pressable>
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: activePage === 'accounts' }}
      onPress={() => onChange('accounts')} style={styles.navItem}>
      <Ionicons name={activePage === 'accounts' ? 'people' : 'people-outline'}
        size={23} color={activePage === 'accounts'
          ? resolveThemeColor('#00c98b', 'accent') : resolveThemeColor('#858991', 'muted')} />
      <Text style={[styles.navText, activePage === 'accounts' && styles.navTextActive]}>{t("client.app.accounts")}</Text>
    </Pressable>
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: discoveryActive }}
      onPress={() => onChange('discover')} style={styles.navItem}>
      <LoungeUnread count={loungeUnread}><DownloadCountIcon owner={loungeUnread ? undefined : owner}>
        <Ionicons name={discoveryActive ? 'compass' : 'compass-outline'} size={23}
          color={discoveryActive ? resolveThemeColor('#00c98b', 'accent') : resolveThemeColor('#858991', 'muted')} />
      </DownloadCountIcon></LoungeUnread>
      <Text style={[styles.navText, discoveryActive && styles.navTextActive]}>{t('client.discovery.title')}</Text>
    </Pressable>
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: settingsActive }}
      onPress={() => onChange('settings')} style={styles.navItem}>
      <Ionicons name="settings" size={23}
        color={settingsActive ? resolveThemeColor('#00c98b', 'accent') : resolveThemeColor('#858991', 'muted')} />
      <Text style={[styles.navText, settingsActive && styles.navTextActive]}>{t("client.app.settings")}</Text>
    </Pressable>
  </SafeAreaView>;
}

const useStyles = createThemedStyles(color => ({
  bottomNavigation: {
    flexDirection: 'row', backgroundColor: color('#fff', 'surface'),
    borderTopWidth: 1, borderTopColor: color('#dce8df', 'border'),
    shadowColor: '#314c3d', shadowOpacity: 0.08, shadowRadius: 8, elevation: 10,
  },
  navItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2 },
  // Give Android room to draw every glyph instead of using the exact intrinsic text width.
  navText: {
    ...textMetrics(11, 18), alignSelf: 'stretch', textAlign: 'center', paddingHorizontal: 4,
    color: color('#7b8c82', 'muted'), fontWeight: '700',
  },
  navTextActive: { color: color('#18af8c', 'accent') },
}));
