import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { View, type GestureResponderHandlers } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { runOnUI } from 'react-native-reanimated';
import { SwipeGestureContext } from '../navigation/SwipeGestureBoundary';
import { useDrawerGesture } from './useDrawerGesture';
import type { NativeDrawerMotion } from './useNativeDrawerMotion';

export const DrawerGestureContext = createContext<NativeDrawerMotion | null>(null);
interface Props { children: ReactNode; enabled: boolean; panHandlers: GestureResponderHandlers; cancel: () => void }

export function ChatDrawerSurface(props: Props) {
  const motion = useContext(DrawerGestureContext);
  return motion ? <DrawerSurface {...props} motion={motion} /> : <View style={{ flex: 1 }}>{props.children}</View>;
}

function DrawerSurface({ children, enabled, panHandlers, cancel, motion }: Props & { motion: NativeDrawerMotion }) {
  const gesture = useDrawerGesture(motion, 'conversation', enabled);
  const cancelSwipe = useCallback(() => {
    cancel();
    runOnUI(() => { 'worklet'; motion.blocked.value = true; })();
  }, [cancel, motion]);
  return <SwipeGestureContext.Provider value={cancelSwipe}>
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={{ flex: 1 }} {...panHandlers}>{children}</View>
    </GestureDetector>
  </SwipeGestureContext.Provider>;
}
