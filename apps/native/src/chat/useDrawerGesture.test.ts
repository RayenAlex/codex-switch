import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GestureTouchEvent } from 'react-native-gesture-handler';
import { useDrawerGesture } from './useDrawerGesture';
import type { NativeDrawerMotion } from './useNativeDrawerMotion';

vi.mock('react', () => ({ useMemo: (create: () => unknown) => create() }));
vi.mock('react-native-reanimated', () => ({ useSharedValue: (value: unknown) => ({ value }) }));
vi.mock('react-native-gesture-handler', () => ({ Gesture: { Manual: () => {
  const handlers: Record<string, unknown> = {};
  const builder: Record<string, unknown> = { handlers };
  for (const name of ['enabled', 'shouldCancelWhenOutside', 'onTouchesDown', 'onTouchesMove', 'onTouchesUp',
    'onTouchesCancelled', 'onFinalize']) builder[name] = (callback: unknown) => {
    handlers[name] = callback;
    return builder;
  };
  return builder;
} } }));

function setup(open = false, surface: Parameters<typeof useDrawerGesture>[1] = open ? 'drawer' : 'conversation') {
  const motion = { offset: { value: open ? 340 : 0 }, opened: { value: open }, settling: { value: false },
    blocked: { value: false }, width: 340, begin: vi.fn(), settle: vi.fn() } as unknown as NativeDrawerMotion;
  const gesture = useDrawerGesture(motion, surface, true);
  const { handlers } = gesture as unknown as {
    handlers: Record<string, (event: GestureTouchEvent, stateManager: typeof manager) => void>;
  };
  let failed = false;
  const manager = { begin: vi.fn(), activate: vi.fn(), end: vi.fn(),
    fail: vi.fn(() => { failed = true; handlers.onFinalize?.({} as GestureTouchEvent, manager); }) };
  const dispatch = (name: string, x = 100, y = 200, count = 1) => {
    if (failed) return;
    const point = { id: 0, absoluteX: x, absoluteY: y, x, y };
    handlers[name]?.({ allTouches: [point], changedTouches: [point], numberOfTouches: count } as GestureTouchEvent, manager);
  };
  return { motion, manager, dispatch };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); });
afterEach(() => vi.useRealTimers());

it.each([false, true])('tracks every drag update and settles open=%s without a JS position callback', open => {
  const { motion, dispatch, manager } = setup(open);
  const direction = open ? -1 : 1;
  dispatch('onTouchesDown', 150);
  for (const distance of [30, 70, 100, 130]) {
    dispatch('onTouchesMove', 150 + direction * distance);
    expect(motion.offset.value).toBe((open ? 340 : 0) + direction * distance);
  }
  expect(motion.begin).toHaveBeenCalledOnce();
  expect(motion.settle).not.toHaveBeenCalled();
  dispatch('onTouchesUp', 150 + direction * 130);
  expect(motion.settle).toHaveBeenCalledExactlyOnceWith(!open);
  expect(manager.end).toHaveBeenCalledOnce();
});

it.each([false, true])('returns cancelled and short drags to open=%s', open => {
  for (const cancel of [false, true]) {
    const { motion, dispatch } = setup(open);
    dispatch('onTouchesDown', 150);
    const x = 150 + (open ? -30 : 30);
    dispatch('onTouchesMove', x);
    dispatch(cancel ? 'onTouchesCancelled' : 'onTouchesUp', x);
    expect(motion.settle).toHaveBeenCalledExactlyOnceWith(open);
  }
});

it.each(['vertical', 'long-press', 'multitouch', 'horizontal-content', 'left', 'settling', 'edge'])(
  'leaves %s gestures alone', reason => {
    const { motion, dispatch, manager } = setup(false, reason === 'edge' ? 'edge' : 'conversation');
    motion.settling.value = reason === 'settling';
    dispatch('onTouchesDown');
    if (reason === 'long-press') vi.advanceTimersByTime(550);
    if (reason === 'horizontal-content') motion.blocked.value = true;
    if (reason === 'vertical') dispatch('onTouchesMove', 100, 230);
    dispatch('onTouchesMove', reason === 'left' ? 60 : 200, 200, reason === 'multitouch' ? 2 : 1);
    expect(manager.activate).not.toHaveBeenCalled();
    expect(motion.offset.value).toBe(0);
  });

it('allows slow release after an immediate claim but cancels a reversed drag', () => {
  const { motion, dispatch } = setup();
  dispatch('onTouchesDown');
  dispatch('onTouchesMove', 180);
  vi.advanceTimersByTime(800);
  dispatch('onTouchesMove', 80);
  expect(motion.offset.value).toBe(0);
  dispatch('onTouchesUp', 80);
  expect(motion.settle).toHaveBeenCalledWith(false);
});
