import { createContext, useContext, useEffect, useRef, type RefObject } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

export interface SheetScrollGesture {
  blocked: boolean;
  dragging?: boolean;
  suspend?: () => () => void;
}
export const SheetScrollGestureContext = createContext<RefObject<SheetScrollGesture> | null>(null);
interface ScrollTarget { setNativeProps: (props: { scrollEnabled: boolean }) => void }

/** Preserve a scroll gesture that began below the top, even if it reaches the top before release. */
export function useSheetScrollGesture({ onScroll, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel,
  scrollEnabled = true }: ScrollViewProps,
  getScrollTarget?: () => ScrollTarget | null | undefined) {
  const gesture = useContext(SheetScrollGestureContext);
  const offset = useRef(0);
  const touch = useRef({ x: 0, y: 0, restore: undefined as (() => void) | undefined });
  const restore = () => { touch.current.restore?.(); touch.current.restore = undefined; };
  useEffect(() => restore, []);
  return {
    scrollEventThrottle: 16,
    onScroll: ((event) => {
      offset.current = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    }) satisfies NonNullable<ScrollViewProps['onScroll']>,
    onTouchStart: ((event) => {
      restore();
      touch.current.x = event.nativeEvent.pageX;
      touch.current.y = event.nativeEvent.pageY;
      if (gesture) {
        if (offset.current > 0) gesture.current.blocked = true;
        const target = getScrollTarget?.();
        // Arm at touch-down: waiting until PanResponder grant is too late for Android's native interception.
        if (offset.current <= 0 && scrollEnabled && target) {
          target.setNativeProps({ scrollEnabled: false });
          touch.current.restore = () => target.setNativeProps({ scrollEnabled });
        }
        const suspendChild = gesture.current.suspend;
        gesture.current.suspend = () => {
          const restoreChild = suspendChild?.();
          return () => { restore(); restoreChild?.(); };
        };
      }
      onTouchStart?.(event);
    }) satisfies NonNullable<ScrollViewProps['onTouchStart']>,
    onTouchMove: ((event) => {
      const dx = event.nativeEvent.pageX - touch.current.x;
      const dy = event.nativeEvent.pageY - touch.current.y;
      if (!gesture?.current.dragging && (dy < -6 || Math.abs(dx) > Math.max(6, Math.abs(dy)))) restore();
      onTouchMove?.(event);
    }) satisfies NonNullable<ScrollViewProps['onTouchMove']>,
    onTouchEnd: ((event) => {
      if (!gesture?.current.dragging) restore();
      onTouchEnd?.(event);
    }) satisfies NonNullable<ScrollViewProps['onTouchEnd']>,
    onTouchCancel: ((event) => {
      if (!gesture?.current.dragging) restore();
      onTouchCancel?.(event);
    }) satisfies NonNullable<ScrollViewProps['onTouchCancel']>,
  };
}

/** Scroll coordination without changing the caller's layout or insets. */
export function SheetGestureScrollView(props: ScrollViewProps) {
  const scroll = useRef<ScrollView>(null);
  const gesture = useSheetScrollGesture(props, () => scroll.current);
  return <ScrollView ref={scroll} {...props} {...gesture} />;
}
