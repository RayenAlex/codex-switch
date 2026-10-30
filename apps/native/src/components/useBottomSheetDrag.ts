import { useEffect, useMemo, useRef, type Component } from 'react';
import { Animated, findNodeHandle, PanResponder, TextInput, type PanResponderCallbacks } from 'react-native';
import { shouldDismissSheet } from '../../../../shared/sheets/dragDismiss';
import type { SheetScrollGesture } from './SheetScrollGesture';

export function useBottomSheetDrag({ visible, enabled, onClose }: {
  visible: boolean; enabled: boolean; onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollGesture = useRef<SheetScrollGesture>({ blocked: false });
  const latest = useRef({ enabled, onClose });
  latest.current = { enabled, onClose };

  useEffect(() => {
    translateY.stopAnimation();
    translateY.setValue(0);
  }, [translateY, visible, enabled]);

  const responders = useMemo(() => {
    let fromHandle = false;
    let cancelled = false;
    let restoreScroll: (() => void) | undefined;
    const reset = () => {
      scrollGesture.current.dragging = false;
      restoreScroll?.();
      restoreScroll = undefined;
      fromHandle = false;
      Animated.spring(translateY, {
        toValue: 0, damping: 22, stiffness: 240, mass: 0.8, useNativeDriver: true,
      }).start();
    };
    const callbacks: PanResponderCallbacks = {
      onPanResponderGrant: () => {
        cancelled = false;
        scrollGesture.current.dragging = true;
        // Android's ScrollView otherwise intercepts the next move and cancels the sheet responder.
        restoreScroll = scrollGesture.current.suspend?.();
        translateY.stopAnimation();
      },
      onPanResponderMove: (_event, gesture) => {
        if (gesture.numberActiveTouches !== 1 || !latest.current.enabled) {
          cancelled = true;
          reset();
        }
        if (!cancelled) translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_event, gesture) => {
        reset();
        if (!cancelled && latest.current.enabled && shouldDismissSheet({
          dx: gesture.dx, dy: gesture.dy, velocityY: gesture.vy,
        })) latest.current.onClose();
      },
      onPanResponderTerminate: reset,
      onPanResponderTerminationRequest: () => !fromHandle,
    };
    return {
      surface: PanResponder.create({
        ...callbacks,
        onStartShouldSetPanResponderCapture: () => { scrollGesture.current = { blocked: false }; return false; },
        onMoveShouldSetPanResponderCapture: (event, gesture) => {
          const input = TextInput.State.currentlyFocusedInput();
          // RN's findNodeHandle typing omits HostInstance, though the native input API returns it.
          const inputTag = input ? findNodeHandle(input as unknown as Component) : null;
          if (inputTag !== null && inputTag === Number(event.nativeEvent.target)) scrollGesture.current.blocked = true;
          if (gesture.dy < -6) scrollGesture.current.blocked = true;
          return !fromHandle && !scrollGesture.current.blocked && latest.current.enabled
            && gesture.numberActiveTouches === 1 && gesture.dy > 6 && gesture.dy > Math.abs(gesture.dx);
        },
      }),
      handle: PanResponder.create({
        ...callbacks,
        // Claim the handle at touch-down; decorative Views do not reliably become move responders on Android.
        onStartShouldSetPanResponder: () => latest.current.enabled,
        onPanResponderGrant: (event, gesture) => {
          callbacks.onPanResponderGrant?.(event, gesture);
          fromHandle = true;
        },
      }),
    };
  }, [translateY]);
  return { translateY, scrollGesture,
    panHandlers: responders.surface.panHandlers, handleHandlers: responders.handle.panHandlers };
}
