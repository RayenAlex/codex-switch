import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { SWIPE_COMPLETE_DISTANCE, SWIPE_DIRECTION_RATIO, SWIPE_LONG_PRESS_MS,
  SWIPE_START_DISTANCE } from '../../../../shared/navigation/pageSwipe';
import type { NativeDrawerMotion } from './useNativeDrawerMotion';

type Surface = 'edge' | 'conversation' | 'drawer';
interface Touch { x: number; y: number; time: number; claimed: boolean }
// Leave room to start just inside Android's system back-gesture strip.
const EDGE_WIDTH = 48;

/** Do not send per-frame touch events through JS or rebuild the gesture during chat updates. */
export function useDrawerGesture(motion: NativeDrawerMotion, surface: Surface, enabled: boolean) {
  const touch = useSharedValue<Touch | null>(null);
  return useMemo(() => Gesture.Manual().enabled(enabled).shouldCancelWhenOutside(false)
    .onTouchesDown((event, manager) => {
      const point = event.allTouches[0];
      if (event.numberOfTouches !== 1 || !point || motion.settling.value
        || (surface === 'drawer') !== motion.opened.value
        || (surface === 'edge' && point.absoluteX > EDGE_WIDTH)
        || (surface === 'conversation' && point.absoluteX <= EDGE_WIDTH)) { manager.fail(); return; }
      motion.blocked.value = false;
      touch.value = { x: point.absoluteX, y: point.absoluteY, time: Date.now(), claimed: false };
      manager.begin();
    })
    .onTouchesMove((event, manager) => {
      const origin = touch.value;
      const point = event.allTouches[0];
      if (!origin || !point || motion.blocked.value || event.numberOfTouches !== 1) {
        manager.fail(); return;
      }
      const dx = point.absoluteX - origin.x;
      const dy = point.absoluteY - origin.y;
      if (!origin.claimed) {
        if ((Math.abs(dy) > SWIPE_START_DISTANCE && Math.abs(dy) >= Math.abs(dx))
          || Date.now() - origin.time >= SWIPE_LONG_PRESS_MS) { manager.fail(); return; }
        if (Math.abs(dx) < SWIPE_START_DISTANCE || Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTION_RATIO) return;
        if ((dx < 0) !== motion.opened.value) { manager.fail(); return; }
        touch.value = { ...origin, claimed: true };
        manager.activate();
        motion.begin();
      }
      motion.offset.value = Math.max(0, Math.min(motion.width, (motion.opened.value ? motion.width : 0) + dx));
    })
    .onTouchesUp((event, manager) => {
      const origin = touch.value;
      const point = event.changedTouches[0];
      if (!origin?.claimed || !point) { manager.fail(); return; }
      const dx = point.absoluteX - origin.x;
      const dy = point.absoluteY - origin.y;
      const completed = !motion.blocked.value && Math.abs(dx) >= SWIPE_COMPLETE_DISTANCE
        && Math.abs(dx) > Math.abs(dy) * SWIPE_DIRECTION_RATIO && (dx < 0) === motion.opened.value;
      touch.value = null;
      motion.settle(completed ? !motion.opened.value : motion.opened.value);
      manager.end();
    })
    .onTouchesCancelled((_event, manager) => { manager.fail(); })
    .onFinalize(() => {
      if (touch.value?.claimed && !motion.settling.value) motion.settle(motion.opened.value);
      touch.value = null;
    }), [motion, surface, enabled, touch]);
}
