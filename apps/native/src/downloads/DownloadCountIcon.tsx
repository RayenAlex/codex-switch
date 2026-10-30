import type { ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { useActiveDownloadCount } from '../../../../shared/downloads/useActiveDownloadCount';
import { t, useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { downloadManager } from './manager';

export function DownloadCountIcon({ owner, children }: { owner?: string; children: ReactNode }) {
  useLanguage();
  const styles = useStyles();
  const count = useActiveDownloadCount({ manager: downloadManager, owners: [owner], enabled: Platform.OS === 'android' });
  return <View style={styles.icon}>
    {children}
    {count > 0 && <Text style={styles.badge} accessibilityLiveRegion="polite"
      accessibilityLabel={t('client.downloads.activeCount', { count })}>{count}</Text>}
  </View>;
}

const useStyles = createThemedStyles(color => ({
  icon: { position: 'relative', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badge: {
    ...textMetrics(10, 12), position: 'absolute', top: -6, right: -10, minWidth: 17,
    paddingHorizontal: 4, borderRadius: 99, backgroundColor: color('#e5484d', 'danger'),
    color: '#fff', fontWeight: '700', textAlign: 'center',
  },
}));
