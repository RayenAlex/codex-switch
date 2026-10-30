import { expect, it, vi } from 'vitest';
import { createDrawerMotion } from '../../../../shared/navigation/drawerMotion';

function setup(initiallyOpen = false) {
  const animation = { setOffset: vi.fn(), stop: vi.fn(), animate: vi.fn((_value: number, _done: () => void) => {}) };
  const onStart = vi.fn();
  const onSettled = vi.fn();
  const motion = createDrawerMotion({ width: 340, initiallyOpen, animation, onStart, onSettled });
  const finish = () => animation.animate.mock.calls.at(-1)![1]();
  return { motion, animation, onStart, onSettled, finish };
}

it('tracks the finger and continues settling from the preview without committing early', () => {
  const { motion, animation, onStart, onSettled, finish } = setup();
  motion.move(30); motion.move(130);
  expect(animation.setOffset.mock.calls).toEqual([[30], [130]]);
  expect(onStart).toHaveBeenCalledOnce();
  expect(onSettled).not.toHaveBeenCalled();
  motion.open();
  expect(animation.animate).toHaveBeenCalledWith(340, expect.any(Function));
  expect(animation.setOffset).toHaveBeenLastCalledWith(130);
  finish();
  expect(onSettled).toHaveBeenCalledExactlyOnceWith(true);
});

it.each([false, true])('returns cancelled gestures to the committed open=%s position', initiallyOpen => {
  const { motion, animation, onSettled, finish } = setup(initiallyOpen);
  motion.move(initiallyOpen ? -110 : 110);
  motion.cancel();
  expect(animation.animate).toHaveBeenCalledWith(initiallyOpen ? 340 : 0, expect.any(Function));
  finish();
  expect(onSettled).toHaveBeenCalledExactlyOnceWith(initiallyOpen);
});

it('bounds reversed and oversized drags without letting another gesture interrupt settling', () => {
  const { motion, animation } = setup();
  motion.move(-40); motion.move(600);
  expect(animation.setOffset.mock.calls).toEqual([[0], [340]]);
  motion.open();
  motion.move(20); motion.cancel(); motion.open();
  expect(animation.setOffset).toHaveBeenCalledTimes(2);
  expect(animation.animate).toHaveBeenCalledOnce();
});

it('ignores stale completion after a close command or disposal', () => {
  const { motion, animation, onSettled, finish } = setup();
  motion.open();
  const finishOpening = animation.animate.mock.calls[0][1];
  motion.close();
  finishOpening();
  expect(onSettled).not.toHaveBeenCalled();
  motion.dispose(); finish();
  expect(onSettled).not.toHaveBeenCalled();
});
