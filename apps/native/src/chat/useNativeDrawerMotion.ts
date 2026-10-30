import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { cancelAnimation, Easing, runOnJS, runOnUI, useAnimatedStyle, useSharedValue,
  withTiming } from 'react-native-reanimated';
import { SWIPE_SETTLE_MS } from '../../../../shared/navigation/pageSwipe';
import { nativeTextSelection } from './nativeTextSelection';

interface Options {
  width: number;
  onOpen: () => void;
  onClose: () => void;
  onMoving: () => void;
}

/** Gesture positions and settling stay on the UI thread, even while chat is rendering. */
export function useNativeDrawerMotion({ width, ...callbacks }: Options) {
  const current = useRef(callbacks);
  current.current = callbacks;
  const [view, setView] = useState({ open: false, visible: false, moving: false });
  const offset = useSharedValue(0);
  const opened = useSharedValue(false);
  const moving = useSharedValue(false);
  const settling = useSharedValue(false);
  const blocked = useSharedValue(false);
  const started = useCallback(() => {
    Keyboard.dismiss();
    nativeTextSelection?.dismiss();
    setView(previous => ({ ...previous, visible: true, moving: true }));
    current.current.onMoving();
  }, []);
  const settled = useCallback((open: boolean) => {
    setView({ open, visible: open, moving: false });
    if (open) current.current.onOpen();
    else current.current.onClose();
  }, []);
  const motion = useMemo(() => {
    const begin = () => {
      'worklet';
      if (moving.value) return;
      moving.value = true;
      runOnJS(started)();
    };
    const settle = (next: boolean) => {
      'worklet';
      cancelAnimation(offset);
      if (!moving.value && opened.value === next) { runOnJS(settled)(next); return; }
      begin();
      settling.value = true;
      offset.value = withTiming(next ? width : 0,
        { duration: SWIPE_SETTLE_MS, easing: Easing.out(Easing.cubic) }, finished => {
          if (!finished) return;
          opened.value = next;
          moving.value = false;
          settling.value = false;
          runOnJS(settled)(next);
        });
    };
    return { offset, opened, moving, settling, blocked, width, begin, settle };
  }, [offset, opened, moving, settling, blocked, width, started, settled]);
  useLayoutEffect(() => {
    runOnUI(() => {
      'worklet';
      cancelAnimation(offset);
      offset.value = opened.value ? width : 0;
      moving.value = false;
      settling.value = false;
      runOnJS(settled)(opened.value);
    })();
    return () => { cancelAnimation(offset); };
  }, [offset, opened, moving, settling, width, settled]);
  const openDrawer = useCallback(() => runOnUI(motion.settle)(true), [motion]);
  const closeDrawer = useCallback(() => runOnUI(motion.settle)(false), [motion]);
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value - width }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: offset.value / width }));
  return { motion, ...view, openDrawer, closeDrawer, panelStyle, overlayStyle };
}

export type NativeDrawerMotion = ReturnType<typeof useNativeDrawerMotion>['motion'];
