import { beforeEach, expect, it, vi } from 'vitest';
import { useNativeDrawerMotion } from './useNativeDrawerMotion';

const runtime = vi.hoisted(() => ({
  jobs: [] as (() => void)[], animations: [] as { target: number; finish: (finished: boolean) => void }[],
  render: vi.fn(),
}));
vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }), useState: (initial: unknown) => [initial, runtime.render],
  useMemo: (create: () => unknown) => create(), useCallback: (callback: unknown) => callback,
  useLayoutEffect: (effect: () => unknown) => effect(),
}));
vi.mock('react-native', () => ({ Keyboard: { dismiss: vi.fn() } }));
vi.mock('./nativeTextSelection', () => ({ nativeTextSelection: { dismiss: vi.fn() } }));
vi.mock('react-native-reanimated', () => ({
  useSharedValue: (value: unknown) => ({ value }), useAnimatedStyle: (read: () => unknown) => read(),
  Easing: { cubic: 'cubic', out: () => 'out' }, runOnUI: (callback: unknown) => callback,
  runOnJS: (callback: (...args: unknown[]) => void) => (...args: unknown[]) => {
    runtime.jobs.push(() => callback(...args));
  },
  cancelAnimation: () => { runtime.animations.at(-1)?.finish(false); },
  withTiming: (target: number, _options: unknown, finish: (finished: boolean) => void) => {
    runtime.animations.push({ target, finish }); return target;
  },
}));

beforeEach(() => { runtime.jobs = []; runtime.animations = []; runtime.render.mockClear(); });
function setup() {
  const onOpen = vi.fn();
  const onClose = vi.fn();
  const onMoving = vi.fn();
  const result = useNativeDrawerMotion({ width: 340, onOpen, onClose, onMoving });
  runtime.jobs.splice(0).forEach(job => job());
  onClose.mockClear(); runtime.render.mockClear();
  return { ...result, onOpen, onClose, onMoving };
}

it('finishes native motion while JS callbacks and React renders are blocked', () => {
  const { motion, onOpen, onMoving } = setup();
  motion.begin();
  motion.offset.value = 130;
  motion.settle(true);
  expect(runtime.animations.at(-1)?.target).toBe(340);
  runtime.animations.at(-1)?.finish(true);
  expect(motion.opened.value).toBe(true);
  expect(motion.moving.value).toBe(false);
  expect(motion.settling.value).toBe(false);
  expect(onMoving).not.toHaveBeenCalled();
  expect(onOpen).not.toHaveBeenCalled();
  expect(runtime.render).not.toHaveBeenCalled();
  runtime.jobs.splice(0).forEach(job => job());
  expect(onMoving).toHaveBeenCalledOnce();
  expect(onOpen).toHaveBeenCalledOnce();
});

it('keeps the committed state when a native animation is interrupted and closes from its current position', () => {
  const { motion, openDrawer, closeDrawer, onOpen, onClose } = setup();
  openDrawer();
  expect(motion.opened.value).toBe(false);
  closeDrawer();
  expect(runtime.animations.at(-1)?.target).toBe(0);
  runtime.animations.at(-1)?.finish(true);
  runtime.jobs.splice(0).forEach(job => job());
  expect(onOpen).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
  expect(motion.opened.value).toBe(false);
});
