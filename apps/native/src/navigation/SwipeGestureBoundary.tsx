import { createContext, useContext } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

export const SwipeGestureContext = createContext<(() => void) | undefined>(undefined);

/** Horizontal content keeps its touch sequence, including drags at either scroll edge. */
export function SwipeSafeScrollView({ onTouchStart, ...props }: ScrollViewProps) {
  const cancelPageSwipe = useContext(SwipeGestureContext);
  return <ScrollView {...props} onTouchStart={event => { cancelPageSwipe?.(); onTouchStart?.(event); }} />;
}
