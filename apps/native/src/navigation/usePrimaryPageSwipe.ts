import { useCallback } from 'react';
import { Keyboard } from 'react-native';
import { adjacentPage, type PrimaryPage, type SwipeProgress } from '../../../../shared/navigation/pageSwipe';
import { useHorizontalSwipe } from './useHorizontalSwipe';

export function usePrimaryPageSwipe(page: string, onChange: (page: PrimaryPage) => void, progress?: SwipeProgress) {
  const previous = adjacentPage(page, 'right');
  const next = adjacentPage(page, 'left');
  const onLeft = useCallback(() => { if (next) { Keyboard.dismiss(); onChange(next); } }, [next, onChange]);
  const onRight = useCallback(() => { if (previous) { Keyboard.dismiss(); onChange(previous); } }, [previous, onChange]);
  // Chat owns its gesture so its drawer and overlays can take precedence.
  // Claim boundary swipes too: a wide row must not receive a tap when the finger lifts.
  return useHorizontalSwipe({ enabled: page !== 'chat' && Boolean(next || previous),
    onLeft, onRight, ...progress }).panHandlers;
}
