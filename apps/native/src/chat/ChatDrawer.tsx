import { useThemeColor } from '../theme/store';
import { createThemedStyles } from '../theme/styles';
import { forwardRef, useEffect, useImperativeHandle, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { chatDrawerWidth } from '../../../../shared/navigation/drawerMotion';
import { useNativeDrawerMotion } from './useNativeDrawerMotion';
import { useDrawerGesture } from './useDrawerGesture';
import { DrawerGestureContext } from './ChatDrawerSurface';

export interface ChatDrawerMethods {
  openDrawer: () => void;
  closeDrawer: () => void;
}
interface Props {
  children: ReactNode; navigation: ReactNode; enabled: boolean;
  onOpen: () => void; onClose: () => void; onMoving: () => void;
}

/** Keep the same mounted list visible during both edge and conversation-surface drags. */
export const ChatDrawer = forwardRef<ChatDrawerMethods, Props>(function ChatDrawer(
  { children, navigation, enabled, onOpen, onClose, onMoving }, ref,
) {
  const drawerStyles = useDrawerStyles();
  const color = useThemeColor();
  const width = chatDrawerWidth(useWindowDimensions().width);
  const { motion, visible, moving, openDrawer, closeDrawer, panelStyle, overlayStyle }
    = useNativeDrawerMotion({ width, onOpen, onClose, onMoving });
  const edge = useDrawerGesture(motion, 'edge', enabled);
  const close = useDrawerGesture(motion, 'drawer', enabled);
  useImperativeHandle(ref, () => ({ openDrawer, closeDrawer }), [openDrawer, closeDrawer]);
  useEffect(() => { if (!enabled) closeDrawer(); }, [enabled, closeDrawer]);
  return <GestureHandlerRootView style={drawerStyles.root}>
    <DrawerGestureContext.Provider value={motion}>
    <GestureDetector gesture={edge}>
    <View collapsable={false} style={drawerStyles.root}
      accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
      {children}
    </View>
    </GestureDetector>
    </DrawerGestureContext.Provider>
    <GestureDetector gesture={close}>
    <View collapsable={false} pointerEvents={visible ? 'box-none' : 'none'} style={drawerStyles.layer}>
    <Animated.View style={[drawerStyles.overlay, overlayStyle]}>
      <Pressable style={drawerStyles.root} onPress={closeDrawer} accessible={false} />
    </Animated.View>
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityViewIsModal={visible}
      accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      renderToHardwareTextureAndroid={moving} shouldRasterizeIOS={moving}
      style={[drawerStyles.panel, { width, backgroundColor: color('#fff', 'surface') }, panelStyle]}>
      {navigation}
    </Animated.View>
    </View>
    </GestureDetector>
  </GestureHandlerRootView>;
});

const useDrawerStyles = createThemedStyles(() => ({
  root: { flex: 1, overflow: 'hidden' },
  layer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(6, 20, 15, 0.45)' },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0,
    borderTopRightRadius: 20, borderBottomRightRadius: 20, overflow: 'hidden' },
}));
