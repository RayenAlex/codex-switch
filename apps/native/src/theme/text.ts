import { Platform, type TextStyle } from 'react-native';

const TEXT_VERTICAL_PADDING = 2;

/** Let Android's system/fallback fonts determine their full ascent and descent. */
export function textMetrics(fontSize: number, lineHeight: number): TextStyle {
  return {
    fontSize,
    includeFontPadding: true,
    paddingVertical: TEXT_VERTICAL_PADDING,
    // RN's explicit line-height span replaces font bounds, which can clip OEM fonts.
    ...(Platform.OS === 'android'
      ? { minHeight: lineHeight + TEXT_VERTICAL_PADDING * 2, textAlignVertical: 'center' }
      : { lineHeight }),
  };
}
