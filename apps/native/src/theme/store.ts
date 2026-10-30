import { useSyncExternalStore } from 'react';
import { themeColor, type ThemeMode, type ThemePreference } from '../../../../shared/theme/mode';

let mode: ThemeMode = 'light';
let preference: ThemePreference = 'system';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getThemeMode = () => mode;
export const useThemeMode = () => useSyncExternalStore(subscribe, getThemeMode, getThemeMode);
export const getThemePreference = () => preference;
export const useThemePreference = () => useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
const colors = { light: themeColor('light'), dark: themeColor('dark') };
export const useThemeColor = () => colors[useThemeMode()];

export function updateTheme(nextPreference: ThemePreference, next: ThemeMode) {
  preference = nextPreference;
  mode = next;
  listeners.forEach(listener => listener());
}

export function updateThemeMode(next: ThemeMode) {
  updateTheme(next, next);
}
