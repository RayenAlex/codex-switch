import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { themeColor, type ThemeColor, type ThemeColorRole } from '../../../../shared/theme/mode';
import { useThemeMode } from '../theme/store';

const darkPalette: Partial<Record<ThemeColorRole, string>> = {
  ink: '#edf2f4', muted: '#a0adb5', faint: '#809099', surface: '#192125', canvas: '#111619',
  elevated: '#212b30', border: '#293238', info: '#a9c9ee', infoSoft: '#273b4e', accent: '#a4c8b0',
};
const dark: ThemeColor = (light, role) => darkPalette[role] ?? themeColor('dark')(light, role);
const light = themeColor('light');
export function useLoungeColor() { return useThemeMode() === 'dark' ? dark : light; }

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
export function createLoungeStyles<T extends NamedStyles<T>>(factory: (color: ThemeColor) => T) {
  const styles = { light: StyleSheet.create(factory(light)), dark: StyleSheet.create(factory(dark)) };
  return () => styles[useThemeMode()];
}
