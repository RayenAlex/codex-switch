import { Animated, Easing } from 'react-native';
import { SWIPE_SETTLE_MS } from '../../../../shared/navigation/pageSwipe';
import type { PageAnimation } from '../../../../shared/navigation/usePageTransition';

export function createPageAnimation(offset: Animated.Value): PageAnimation {
  return {
    setOffset: value => offset.setValue(value),
    stop: () => offset.stopAnimation(),
    animate: (toValue, complete) => Animated.timing(offset, {
      toValue, duration: SWIPE_SETTLE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(({ finished }) => {
      // RN synchronizes the final native value after invoking this callback. Resetting it
      // synchronously gets overwritten and leaves the newly selected page offscreen.
      if (finished) queueMicrotask(complete);
    }),
  };
}
