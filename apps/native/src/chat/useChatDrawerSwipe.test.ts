import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { useChatDrawerSwipe } from './useChatDrawerSwipe';

vi.mock('react', () => ({ useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  createContext: () => ({}), useContext: () => undefined,
  useMemo: (factory: () => unknown) => factory() }));
vi.mock('react-native', () => ({ PanResponder: { create: vi.fn(() => ({ panHandlers: {} })) } }));

const event = {} as GestureResponderEvent;
const gesture = (dx: number, dy = 0) => ({ dx: -dx, dy, numberActiveTouches: 1 } as PanResponderGestureState);
function setup(enabled = true) {
  const open = vi.fn();
  useChatDrawerSwipe(enabled, open);
  const handlers = vi.mocked(PanResponder.create).mock.calls.at(-1)![0];
  handlers.onStartShouldSetPanResponderCapture!(event, gesture(0));
  return { open, handlers };
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

it('leaves right drags to the native drawer and cancels left page drags without navigation', () => {
  const { open, handlers } = setup();
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(-30))).toBe(false);
  handlers.onStartShouldSetPanResponderCapture!(event, gesture(0));
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(30))).toBe(true);
  handlers.onPanResponderMove!(event, gesture(120));
  expect(open).not.toHaveBeenCalled();
  handlers.onPanResponderTerminate!(event, gesture(120));
  expect(open).not.toHaveBeenCalled();
});

it('keeps long-press text selection instead of claiming its horizontal drag', () => {
  const { open, handlers } = setup();
  vi.advanceTimersByTime(550);
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(80))).toBe(false);
  handlers.onPanResponderRelease!(event, gesture(120));
  expect(open).not.toHaveBeenCalled();
});

it('navigates for an immediate left swipe even when the finger is released slowly', () => {
  const { open, handlers } = setup();
  vi.advanceTimersByTime(100);
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(30))).toBe(true);
  vi.advanceTimersByTime(800);
  handlers.onPanResponderRelease!(event, gesture(120));
  expect(open).toHaveBeenCalledOnce();
});

it.each([[0, 25], [-25, 0], [10, 0]])('does not open for a non-horizontal or short gesture (%i, %i)', (dx, dy) => {
  const { open, handlers } = setup();
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(dx, dy))).toBe(false);
  handlers.onPanResponderRelease!(event, gesture(dx, dy));
  expect(open).not.toHaveBeenCalled();
});

it('resets the long-press guard for the next touch', () => {
  const { open, handlers } = setup();
  vi.advanceTimersByTime(550);
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(80))).toBe(false);
  handlers.onStartShouldSetPanResponderCapture!(event, gesture(0));
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(80))).toBe(true);
  handlers.onPanResponderRelease!(event, gesture(120));
  expect(open).toHaveBeenCalledOnce();
});
