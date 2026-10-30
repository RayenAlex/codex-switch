import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Keyboard, PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { usePrimaryPageSwipe } from './usePrimaryPageSwipe';
import { useChatDrawerSwipe } from '../chat/useChatDrawerSwipe';

vi.mock('react', () => ({ useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  createContext: () => ({}), useContext: () => undefined,
  useMemo: (factory: () => unknown) => factory() }));
vi.mock('react-native', () => ({ Keyboard: { dismiss: vi.fn() },
  PanResponder: { create: vi.fn(() => ({ panHandlers: {} })) } }));

const event = {} as GestureResponderEvent;
const gesture = (dx: number, dy = 0, touches = 1) => (
  { dx, dy, numberActiveTouches: touches } as PanResponderGestureState
);
function setup(page: string) {
  const change = vi.fn();
  usePrimaryPageSwipe(page, change);
  const handlers = vi.mocked(PanResponder.create).mock.calls.at(-1)![0];
  handlers.onStartShouldSetPanResponderCapture!(event, gesture(0));
  return { change, handlers };
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

it.each([
  ['accounts', -100, 'discover'], ['accounts', 100, 'chat'],
  ['discover', -100, 'settings'], ['discover', 100, 'accounts'], ['settings', 100, 'discover'],
])('swipes from %s by %i to %s', (page, dx, next) => {
  const { change, handlers } = setup(page);
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(Number(dx)))).toBe(true);
  expect(change).not.toHaveBeenCalled();
  handlers.onPanResponderRelease!(event, gesture(Number(dx)));
  expect(change).toHaveBeenCalledExactlyOnceWith(next);
  expect(Keyboard.dismiss).toHaveBeenCalledOnce();
  handlers.onPanResponderRelease!(event, gesture(Number(dx)));
  expect(change).toHaveBeenCalledOnce();
});

it.each(['chat', 'devices', 'totp', 'downloads', 'about', 'token-summary', 'admin'])(
  'leaves %s to its own gestures', page => {
    for (const dx of [-100, 100]) {
      const { change, handlers } = setup(page);
      expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(dx))).toBe(false);
      handlers.onPanResponderRelease!(event, gesture(dx));
      expect(change).not.toHaveBeenCalled();
    }
  });

it('does not wrap past settings', () => {
  const { change, handlers } = setup('settings');
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(-100))).toBe(true);
  handlers.onPanResponderRelease!(event, gesture(-100));
  expect(change).not.toHaveBeenCalled();
});

it.each([[8, 0, 1], [0, 80, 1], [-90, 70, 1], [-100, 0, 2]])(
  'ignores short, vertical, diagonal and multitouch drags (%i, %i, %i)', (dx, dy, touches) => {
    const { change, handlers } = setup('accounts');
    expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(dx, dy, touches))).toBe(false);
    handlers.onPanResponderRelease!(event, gesture(dx, dy));
    expect(change).not.toHaveBeenCalled();
  });

it.each(['terminate', 'multitouch', 'reverse', 'short'])(
  'does not navigate when a claimed swipe becomes %s', reason => {
    const { change, handlers } = setup('accounts');
    expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(-30))).toBe(true);
    if (reason === 'terminate') handlers.onPanResponderTerminate!(event, gesture(-30));
    if (reason === 'multitouch') handlers.onPanResponderStart!(event, gesture(-30, 0, 2));
    const dx = reason === 'reverse' ? 100 : reason === 'short' ? -40 : -100;
    handlers.onPanResponderRelease!(event, gesture(dx));
    expect(change).not.toHaveBeenCalled();
  });

it('keeps a vertical-first gesture and a long press from later becoming a page swipe', () => {
  for (const longPress of [false, true]) {
    const { change, handlers } = setup('accounts');
    if (longPress) vi.advanceTimersByTime(550);
    else handlers.onMoveShouldSetPanResponderCapture!(event, gesture(0, 30));
    expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(-100))).toBe(false);
    handlers.onPanResponderRelease!(event, gesture(-100));
    expect(change).not.toHaveBeenCalled();
  }
});

it('opens accounts on a left chat swipe and leaves right swipes to the native drawer', () => {
  const next = vi.fn();
  useChatDrawerSwipe(true, next);
  const handlers = vi.mocked(PanResponder.create).mock.calls.at(-1)![0];
  for (const dx of [-100, 100]) {
    handlers.onStartShouldSetPanResponderCapture!(event, gesture(0));
    expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(dx))).toBe(dx < 0);
    handlers.onPanResponderRelease!(event, gesture(dx));
  }
  expect(next).toHaveBeenCalledOnce();
});
