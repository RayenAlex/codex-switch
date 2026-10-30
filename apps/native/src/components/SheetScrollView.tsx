import { createThemedStyles } from '../theme/styles';
import { useRef, type ReactNode } from 'react';
import { FlatList, ScrollView, View, type FlatListProps, type ScrollViewProps,
  type StyleProp, type ViewStyle } from 'react-native';
import { useSheetScrollGesture } from './SheetScrollGesture';

export const SHEET_HORIZONTAL_PADDING = 20;
export const SHEET_READABLE_WIDTH = 400 + SHEET_HORIZONTAL_PADDING * 2;

/** Keep the viewport at the sheet edge; only its contents receive horizontal padding. */
export function SheetScrollView({ style, contentContainerStyle, ...props }: ScrollViewProps) {
  const sheetScrollStyles = useSheetScrollStyles();
  const scroll = useRef<ScrollView>(null);
  const gesture = useSheetScrollGesture(props, () => scroll.current);
  return <ScrollView ref={scroll} showsVerticalScrollIndicator {...props} {...gesture}
    style={[sheetScrollStyles.viewport, style]}
    contentContainerStyle={[sheetScrollStyles.inset, contentContainerStyle]} />;
}

export function SheetFlatList<Item>({ style, contentContainerStyle, ...props }: FlatListProps<Item>) {
  const sheetScrollStyles = useSheetScrollStyles();
  const scroll = useRef<FlatList<Item>>(null);
  const gesture = useSheetScrollGesture(props, () => {
    const target = scroll.current?.getNativeScrollRef();
    return target && 'setNativeProps' in target ? target : null;
  });
  return <FlatList ref={scroll} showsVerticalScrollIndicator {...props} {...gesture}
    style={[sheetScrollStyles.viewport, style]}
    contentContainerStyle={[sheetScrollStyles.inset, contentContainerStyle]} />;
}

/** Fixed controls retain the same inset as the scrollable content beneath them. */
export function SheetInset({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const sheetScrollStyles = useSheetScrollStyles();
  return <View style={[sheetScrollStyles.inset, style]}>{children}</View>;
}

const useSheetScrollStyles = createThemedStyles(() => ({
  viewport: { flexShrink: 1 },
  inset: { paddingHorizontal: SHEET_HORIZONTAL_PADDING },
}));
