import { beforeEach, expect, it, vi } from 'vitest';
import { usePageTransition } from '../../../../shared/navigation/usePageTransition';
import { usePrimaryPageSwipe } from './usePrimaryPageSwipe';
import { PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';

const lifecycle = vi.hoisted(() => ({ cleanup: undefined as (() => void) | undefined, preview: vi.fn() }));
vi.mock('react', () => ({
  useState: () => [{ preview: null }, lifecycle.preview],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useLayoutEffect: (effect: () => () => void) => { lifecycle.cleanup = effect(); },
}));
vi.mock('react-native', () => ({ Keyboard: { dismiss: vi.fn() },
  PanResponder: { create: vi.fn(() => ({ panHandlers: {} })) } }));

const event = {} as GestureResponderEvent;
const gesture = (dx: number, touches = 1) => ({ dx, dy: 0, numberActiveTouches: touches } as PanResponderGestureState);
function setup(page = 'accounts') {
  const change = vi.fn();
  const animation = { setOffset: vi.fn(), stop: vi.fn(), animate: vi.fn((_offset: number, _done: () => void) => {}) };
  const transition = usePageTransition({ page, width: 390, onChange: change, animation });
  usePrimaryPageSwipe(page, transition.navigate, transition.progress);
  const handlers = vi.mocked(PanResponder.create).mock.calls.at(-1)![0];
  handlers.onStartShouldSetPanResponderCapture!(event, gesture(0));
  return { change, animation, transition, handlers };
}
beforeEach(() => { vi.clearAllMocks(); });

it('shows the neighboring page while dragging and commits only after settling', () => {
  const { handlers, change, animation } = setup();
  expect(handlers.onMoveShouldSetPanResponderCapture!(event, gesture(-20))).toBe(true);
  expect(lifecycle.preview).toHaveBeenLastCalledWith({ preview: { page: 'discover', direction: 'left' } });
  handlers.onPanResponderMove!(event, gesture(-150));
  expect(animation.setOffset).toHaveBeenLastCalledWith(-540);
  expect(change).not.toHaveBeenCalled();
  handlers.onPanResponderRelease!(event, gesture(-150));
  expect(animation.animate).toHaveBeenCalledWith(-780, expect.any(Function));
  expect(change).not.toHaveBeenCalled();
  animation.animate.mock.calls[0][1]();
  expect(change).toHaveBeenCalledExactlyOnceWith('discover');
});

it.each(['short', 'reverse', 'terminate', 'multitouch'])(
  'animates back to the same page for a %s gesture', reason => {
    const { handlers, change, animation } = setup();
    handlers.onMoveShouldSetPanResponderCapture!(event, gesture(-30));
    handlers.onPanResponderMove!(event, gesture(-100));
    if (reason === 'terminate') handlers.onPanResponderTerminate!(event, gesture(-100));
    else if (reason === 'multitouch') handlers.onPanResponderStart!(event, gesture(-100, 2));
    else handlers.onPanResponderRelease!(event, gesture(reason === 'short' ? -40 : 100));
    expect(animation.animate).toHaveBeenCalledWith(-390, expect.any(Function));
    animation.animate.mock.calls[0][1]();
    expect(change).not.toHaveBeenCalled();
    expect(lifecycle.preview).toHaveBeenLastCalledWith({ preview: null });
  });

it('clamps movement to one page and does not schedule a render for every move', () => {
  const { transition, animation } = setup();
  lifecycle.preview.mockClear();
  for (const dx of [-20, -40, -150, -500]) transition.progress.onMove(dx, 'left');
  expect(lifecycle.preview).toHaveBeenCalledOnce();
  expect(animation.setOffset).toHaveBeenLastCalledWith(-780);
  transition.progress.onMove(100, 'left');
  expect(animation.setOffset).toHaveBeenLastCalledWith(-390);
});

it.each([
  ['chat', 'accounts', 'left', -390], ['accounts', 'discover', 'left', -780],
  ['discover', 'settings', 'left', -1170], ['settings', 'discover', 'right', -780],
  ['discover', 'accounts', 'right', -390], ['accounts', 'chat', 'right', 0],
] as const)('keeps %s to %s at its final position while React has not committed', (from, to, direction, offset) => {
  const { transition, animation, change } = setup(from);
  transition.progress.onMove(direction === 'left' ? -150 : 150, direction);
  transition.navigate(to);
  expect(animation.animate).toHaveBeenCalledWith(offset, expect.any(Function));
  animation.setOffset.mockClear(); lifecycle.preview.mockClear();
  animation.animate.mock.calls[0][1]();
  expect(change).toHaveBeenCalledExactlyOnceWith(to);
  expect(animation.setOffset).not.toHaveBeenCalled();
  expect(lifecycle.preview).not.toHaveBeenCalled();
  transition.progress.onMove(-150, 'left');
  transition.navigate(to);
  expect(animation.animate).toHaveBeenCalledOnce();
  expect(animation.setOffset).not.toHaveBeenCalled();
});

it('does not reveal a blank page beyond the last tab', () => {
  const { transition, animation } = setup('settings');
  lifecycle.preview.mockClear(); animation.setOffset.mockClear();
  transition.progress.onMove(-150, 'left');
  transition.navigate('settings');
  expect(lifecycle.preview).not.toHaveBeenCalled();
  expect(animation.setOffset).not.toHaveBeenCalled();
  expect(animation.animate).not.toHaveBeenCalled();
});

it('ignores another swipe during settling and cancels stale completion after leaving the page', () => {
  const { transition, animation, change } = setup();
  transition.progress.onMove(-150, 'left');
  transition.navigate('discover');
  animation.setOffset.mockClear();
  transition.progress.onMove(200, 'right');
  transition.navigate('chat');
  expect(animation.setOffset).not.toHaveBeenCalled();
  expect(animation.animate).toHaveBeenCalledOnce();
  lifecycle.cleanup?.();
  animation.animate.mock.calls[0][1]();
  expect(change).not.toHaveBeenCalled();
  expect(animation.stop).toHaveBeenCalledTimes(2);
});
