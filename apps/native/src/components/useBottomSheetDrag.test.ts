import { beforeEach, expect, it, vi } from 'vitest';
import type { GestureResponderEvent, PanResponderCallbacks, PanResponderGestureState } from 'react-native';
import { useBottomSheetDrag } from './useBottomSheetDrag';
import { useSheetScrollGesture } from './SheetScrollGesture';
import type { SheetScrollGesture } from './SheetScrollGesture';

const state = vi.hoisted(() => ({ responders: [] as PanResponderCallbacks[], position: 0,
  input: null as number | null, context: { current: { blocked: false } as SheetScrollGesture } }));
vi.mock('react', () => ({
  useRef: <T>(current: T) => ({ current }), useMemo: (create: () => unknown) => create(),
  useEffect: (effect: () => void) => effect(), createContext: () => ({}), useContext: () => state.context,
}));
vi.mock('react-native', () => ({
  ScrollView: 'ScrollView', TextInput: { State: { currentlyFocusedInput: () => state.input } },
  findNodeHandle: (node: number) => node,
  Animated: { Value: class {
    stopAnimation() {} setValue(value: number) { state.position = value; }
  }, spring: () => ({ start: () => { state.position = 0; } }) },
  PanResponder: { create: (handlers: PanResponderCallbacks) => {
    state.responders.push(handlers); return { panHandlers: {} };
  } },
}));
beforeEach(() => {
  state.responders = []; state.position = 0; state.input = null; state.context.current = { blocked: false };
});

const event = { nativeEvent: { target: '42' } } as GestureResponderEvent;
const gesture = (dy: number, extra: Partial<PanResponderGestureState> = {}) => (
  { dx: 0, dy, vy: 0, numberActiveTouches: 1, ...extra } as PanResponderGestureState
);

it('claims the handle immediately and follows the finger before closing', () => {
  const close = vi.fn();
  useBottomSheetDrag({ visible: true, enabled: true, onClose: close });
  const [surface, handle] = state.responders;
  expect(handle.onStartShouldSetPanResponder?.(event, gesture(0))).toBe(true);
  handle.onPanResponderGrant?.(event, gesture(0));
  expect(surface.onMoveShouldSetPanResponderCapture?.(event, gesture(100))).toBe(false);
  handle.onPanResponderMove?.(event, gesture(100));
  expect(state.position).toBe(100);
  expect(close).not.toHaveBeenCalled();
  handle.onPanResponderRelease?.(event, gesture(100));
  expect(close).toHaveBeenCalledOnce();
  expect(state.position).toBe(0);
});

it.each(['short', 'up', 'horizontal', 'cancel', 'multitouch', 'disabled'])(
  'does not close on %s gestures', kind => {
    const close = vi.fn();
    useBottomSheetDrag({ visible: true, enabled: kind !== 'disabled', onClose: close });
    const handle = state.responders[1];
    handle.onPanResponderGrant?.(event, gesture(0));
    const move = gesture(kind === 'short' ? 20 : kind === 'up' ? -100 : 100,
      { dx: kind === 'horizontal' ? 200 : 0, numberActiveTouches: kind === 'multitouch' ? 2 : 1 });
    handle.onPanResponderMove?.(event, move);
    if (kind === 'cancel') handle.onPanResponderTerminate?.(event, move);
    else handle.onPanResponderRelease?.(event, move);
    expect(close).not.toHaveBeenCalled();
    expect(state.position).toBe(0);
  },
);

it('allows body drags only at the top and preserves editing, horizontal and upward scrolling', () => {
  const close = vi.fn();
  const { scrollGesture } = useBottomSheetDrag({ visible: true, enabled: true, onClose: close });
  const surface = state.responders[0];
  const claim = (dy: number, dx = 0) => surface.onMoveShouldSetPanResponderCapture?.(event, gesture(dy, { dx }));
  expect(claim(80)).toBe(true);
  scrollGesture.current.blocked = true;
  expect(claim(80)).toBe(false);
  surface.onStartShouldSetPanResponderCapture?.(event, gesture(0));
  expect(claim(80)).toBe(true);
  expect(claim(20, 80)).toBe(false);
  expect(claim(-20)).toBe(false);
  expect(claim(80)).toBe(false);
  surface.onStartShouldSetPanResponderCapture?.(event, gesture(0));
  state.input = 42;
  expect(claim(80)).toBe(false);
});

it('keeps a gesture in its scrolling list until release and forwards existing callbacks', () => {
  const onScroll = vi.fn(); const onTouchStart = vi.fn();
  const handlers = useSheetScrollGesture({ onScroll, onTouchStart });
  const scroll = (y: number) => handlers.onScroll({
    nativeEvent: { contentOffset: { y } },
  } as Parameters<typeof handlers.onScroll>[0]);
  scroll(50);
  handlers.onTouchStart(event);
  expect(state.context.current.blocked).toBe(true);
  scroll(0);
  expect(state.context.current.blocked).toBe(true);
  state.context.current = { blocked: false };
  handlers.onTouchStart(event);
  expect(state.context.current.blocked).toBe(false);
  expect(onScroll).toHaveBeenCalledTimes(2);
  expect(onTouchStart).toHaveBeenCalledTimes(2);
});

it('suspends the touched scroll view during a sheet drag and restores it on release', () => {
  const { scrollGesture } = useBottomSheetDrag({ visible: true, enabled: true, onClose: vi.fn() });
  const restore = vi.fn();
  const suspend = vi.fn(() => restore);
  scrollGesture.current.suspend = suspend;
  const surface = state.responders[0];
  surface.onPanResponderGrant?.(event, gesture(0));
  expect(suspend).toHaveBeenCalledOnce();
  surface.onPanResponderRelease?.(event, gesture(30));
  expect(restore).toHaveBeenCalledOnce();
});

it('arms an Android list at touch-down but restores native scrolling for an upward drag', () => {
  const target = { setNativeProps: vi.fn() };
  const handlers = useSheetScrollGesture({}, () => target);
  const touch = (y: number) => ({ nativeEvent: { pageX: 100, pageY: y } }) as GestureResponderEvent;
  handlers.onTouchStart(touch(100));
  expect(target.setNativeProps).toHaveBeenLastCalledWith({ scrollEnabled: false });
  handlers.onTouchMove(touch(80));
  expect(target.setNativeProps).toHaveBeenLastCalledWith({ scrollEnabled: true });
  target.setNativeProps.mockClear();
  handlers.onScroll({ nativeEvent: { contentOffset: { y: 50 } } } as Parameters<typeof handlers.onScroll>[0]);
  handlers.onTouchStart(touch(100));
  expect(target.setNativeProps).not.toHaveBeenCalled();
  expect(state.context.current.blocked).toBe(true);
});
