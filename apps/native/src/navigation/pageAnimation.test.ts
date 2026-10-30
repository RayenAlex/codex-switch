import { expect, it, vi } from 'vitest';
import { Animated } from 'react-native';
import { createPageAnimation } from './pageAnimation';

vi.mock('react-native', () => ({
  Animated: { timing: vi.fn() }, Easing: { out: () => undefined, cubic: () => undefined },
}));

it('resets the page only after React Native synchronizes the final native animation value', async () => {
  let value = -100;
  const offset = { setValue: (next: number) => { value = next; }, stopAnimation: vi.fn() };
  vi.mocked(Animated.timing).mockImplementation((_offset, config) => ({
    start: callback => {
      callback?.({ finished: true });
      // RN 0.79 Animation.__startAnimationIfNative updates JS nodes after onEnd returns.
      value = config.toValue as number;
    }, stop: vi.fn(), reset: vi.fn(),
  }));
  const animation = createPageAnimation(offset as unknown as Animated.Value);
  const complete = vi.fn(() => animation.setOffset(0));
  animation.animate(-390, complete);
  expect(value).toBe(-390);
  expect(complete).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(complete).toHaveBeenCalledOnce();
  expect(value).toBe(0);
});

it('does not commit a stopped animation', async () => {
  vi.mocked(Animated.timing).mockReturnValue({
    start: callback => callback?.({ finished: false }), stop: vi.fn(), reset: vi.fn(),
  });
  const complete = vi.fn();
  createPageAnimation({} as Animated.Value).animate(0, complete);
  await Promise.resolve();
  expect(complete).not.toHaveBeenCalled();
});
