import { beforeEach, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
const appearance = vi.hoisted(() => ({
  system: 'light' as string | null,
  override: null as string | null,
  listeners: new Set<(event: { colorScheme: string | null }) => void>(),
}));
vi.mock('expo-secure-store', () => ({ getItemAsync: storage.get, setItemAsync: storage.set }));
vi.mock('react-native', () => ({ Appearance: {
  setColorScheme: (value: string | null) => { appearance.override = value; },
  getColorScheme: () => appearance.override ?? appearance.system,
  addChangeListener: (listener: (event: { colorScheme: string | null }) => void) => {
    appearance.listeners.add(listener);
    return { remove: () => appearance.listeners.delete(listener) };
  },
}, Platform: { OS: 'android' } }));
vi.mock('expo-system-ui', () => ({ setBackgroundColorAsync: () => Promise.resolve() }));
vi.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: () => Promise.resolve(), setButtonStyleAsync: () => Promise.resolve(),
}));

beforeEach(() => {
  vi.resetModules(); storage.get.mockReset(); storage.set.mockReset();
  appearance.system = 'light'; appearance.override = null; appearance.listeners.clear();
});

function changeSystemTheme(colorScheme: string | null) {
  appearance.system = colorScheme;
  appearance.listeners.forEach(listener => listener({ colorScheme }));
}

it.each([null, 'invalid', 'system'])('defaults to the current system theme for %s', async saved => {
  appearance.system = 'dark';
  storage.get.mockResolvedValue(saved);
  const { loadTheme, getThemeMode, getThemePreference } = await import('./preference');
  await loadTheme();
  expect(getThemePreference()).toBe('system');
  expect(getThemeMode()).toBe('dark');
  changeSystemTheme('light');
  expect(getThemeMode()).toBe('light');
  changeSystemTheme('dark');
  expect(getThemeMode()).toBe('dark');
  changeSystemTheme(null);
  expect(getThemeMode()).toBe('light');
  expect(storage.set).not.toHaveBeenCalled();
});

it('preserves manual choices and resumes following the system after clearing the override', async () => {
  const { loadTheme, setThemeMode, getThemeMode, getThemePreference } = await import('./preference');
  await loadTheme();
  await loadTheme();
  expect(appearance.listeners.size).toBe(1);
  await setThemeMode('light');
  changeSystemTheme('dark');
  expect(getThemeMode()).toBe('light');
  expect(getThemePreference()).toBe('light');
  expect(appearance.listeners.size).toBe(0);
  await setThemeMode('system');
  expect(appearance.override).toBeNull();
  expect(getThemeMode()).toBe('dark');
  expect(getThemePreference()).toBe('system');
  expect(storage.set).toHaveBeenLastCalledWith(expect.any(String), 'system');
  changeSystemTheme('light');
  expect(getThemeMode()).toBe('light');
});

it('restores a saved theme and tolerates invalid or unavailable storage', async () => {
  const { loadTheme, getThemeMode } = await import('./preference');
  storage.get.mockResolvedValue('dark');
  await loadTheme();
  expect(getThemeMode()).toBe('dark');
  storage.get.mockResolvedValue('invalid');
  await loadTheme();
  expect(getThemeMode()).toBe('light');
  storage.get.mockRejectedValue(new Error('Unavailable'));
  appearance.system = 'dark';
  await expect(loadTheme()).resolves.toBeUndefined();
  expect(getThemeMode()).toBe('dark');
});

it('keeps a new choice when an earlier startup read finishes late', async () => {
  const { loadTheme, setThemeMode, getThemeMode } = await import('./preference');
  let finishRead: (value: string) => void = () => {};
  storage.get.mockImplementation(() => new Promise(resolve => { finishRead = resolve; }));
  const loading = loadTheme();
  await setThemeMode('dark');
  finishRead('light');
  await loading;
  expect(getThemeMode()).toBe('dark');
});

it('serializes rapid changes and reports a failed save without reverting the visible choice', async () => {
  const { setThemeMode, getThemeMode } = await import('./preference');
  let finishWrite: () => void = () => {};
  storage.set.mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));
  const first = setThemeMode('dark');
  const second = setThemeMode('light');
  await Promise.resolve();
  expect(storage.set).toHaveBeenCalledTimes(1);
  expect(getThemeMode()).toBe('light');
  finishWrite();
  await Promise.all([first, second]);
  expect(storage.set.mock.calls.map(call => call[1])).toEqual(['dark', 'light']);
  storage.set.mockRejectedValueOnce(new Error('Unavailable'));
  await expect(setThemeMode('dark')).resolves.toBe(false);
  expect(getThemeMode()).toBe('dark');
});
