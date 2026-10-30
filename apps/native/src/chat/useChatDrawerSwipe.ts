import { usePageSwipe } from '../../../../shared/navigation/PageSwipeContext';
import { useHorizontalSwipe } from '../navigation/useHorizontalSwipe';

/** Left swipes still navigate pages; the drawer's right swipe is owned by its native gesture. */
export function useChatDrawerSwipe(enabled: boolean, onNext?: () => void) {
  const swipe = usePageSwipe();
  return useHorizontalSwipe({ enabled, onLeft: swipe?.onNext ?? onNext,
    onMove: swipe?.onMove, onEnd: swipe?.onEnd });
}
