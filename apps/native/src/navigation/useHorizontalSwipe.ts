import { useMemo } from 'react';
import { PanResponder, type GestureResponderEvent } from 'react-native';
import {
  horizontalDirection, verticalSwipe, SWIPE_COMPLETE_DISTANCE, SWIPE_LONG_PRESS_MS,
  type SwipeDirection, type SwipeProgress,
} from '../../../../shared/navigation/pageSwipe';

interface Options extends SwipeProgress {
  enabled: boolean; onLeft?: () => void; onRight?: () => void;
  shouldStart?: (event: GestureResponderEvent) => boolean;
}

export function useHorizontalSwipe({ enabled, onLeft, onRight, onMove, onEnd, shouldStart }: Options) {
  return useMemo(() => {
    let ignored = true;
    let started = 0;
    let claimed: SwipeDirection | undefined;
    const actions = { left: onLeft, right: onRight };
    const cancel = () => {
      if (claimed) onEnd?.();
      ignored = true; claimed = undefined;
    };
    const responder = PanResponder.create({
      onStartShouldSetPanResponderCapture: event => {
        ignored = !enabled || (shouldStart !== undefined && !shouldStart(event));
        claimed = undefined;
        started = Date.now();
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_event, gesture) => {
        if (ignored) return false;
        const { dx, dy, numberActiveTouches } = gesture;
        if (numberActiveTouches !== 1 || verticalSwipe(dx, dy)
          || Date.now() - started >= SWIPE_LONG_PRESS_MS) { cancel(); return false; }
        const direction = horizontalDirection(dx, dy);
        if (!direction) return false;
        if (!actions[direction]) { cancel(); return false; }
        claimed = direction;
        onMove?.(dx, direction);
        return true;
      },
      onPanResponderStart: (_event, gesture) => { if (gesture.numberActiveTouches !== 1) cancel(); },
      onPanResponderMove: (_event, gesture) => {
        if (gesture.numberActiveTouches !== 1) { cancel(); return; }
        if (!ignored && claimed) onMove?.(gesture.dx, claimed);
      },
      onPanResponderRelease: (_event, gesture) => {
        const direction = horizontalDirection(gesture.dx, gesture.dy, SWIPE_COMPLETE_DISTANCE);
        const action = !ignored && direction === claimed && direction ? actions[direction] : undefined;
        if (claimed) onEnd?.(action ? direction : undefined);
        ignored = true; claimed = undefined;
        action?.();
      },
      onPanResponderTerminate: cancel,
    });
    return { panHandlers: responder.panHandlers, cancel };
  }, [enabled, onLeft, onRight, onMove, onEnd, shouldStart]);
}
