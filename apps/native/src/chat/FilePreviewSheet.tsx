import { useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheet, type BottomSheetAction } from '../components/BottomSheet';
import { t, useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';

export function FilePreviewSheet({ path, previewable, close, actions, children }: {
  path: string; previewable: boolean; close: () => void; actions: BottomSheetAction[]; children: ReactNode;
}) {
  useLanguage();
  const styles = useStyles();
  const color = useThemeColor();
  const [fullscreen, setFullscreen] = useState(false);
  return <BottomSheet visible tall fullWidthContent fillHeight={previewable} fullscreen={fullscreen}
    compactHeader={fullscreen} truncateTitle={fullscreen}
    title={fullscreen ? path.split(/[\\/]/).at(-1) || t('client.projectBrowser.filePreview')
      : t('client.chat.files.39932f')}
    subtitle={fullscreen ? undefined : path} onClose={close}
    onBack={fullscreen ? () => setFullscreen(false) : undefined}
    titleAction={previewable && <Pressable accessibilityRole="button"
      accessibilityLabel={t(fullscreen ? 'client.projectBrowser.exitFullscreen' : 'client.projectBrowser.enterFullscreen')}
      onPress={() => setFullscreen(value => !value)} style={styles.toggle}>
      <MaterialCommunityIcons name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={24}
        color={color('#0b8065', 'accent')} />
    </Pressable>}
    actions={fullscreen ? [] : actions}>
    {children}
  </BottomSheet>;
}

const useStyles = createThemedStyles(color => ({
  toggle: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: color('#eef3f0', 'canvas') },
}));
