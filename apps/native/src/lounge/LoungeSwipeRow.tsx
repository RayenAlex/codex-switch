import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { t } from '../i18n';
import { textMetrics } from '../theme/text';
import { createLoungeStyles } from './theme';

const ACTION_WIDTH = 76;
const DRAG_THRESHOLD = 12;
const useStyles = createLoungeStyles(color => ({
  container: { overflow: 'hidden', borderRadius: 14 },
  content: { backgroundColor: color('#f5f7f8', 'canvas') },
  action: { position: 'absolute', left: 0, top: 0, bottom: 0, width: ACTION_WIDTH,
    backgroundColor: '#c8434b', alignItems: 'center', justifyContent: 'center' },
  label: { ...textMetrics(14, 21), color: '#fff' },
}));

export function LoungeSwipeRow({ enabled, remove, children }: {
  enabled: boolean; remove: () => void; children: ReactNode;
}) {
  const styles = useStyles();
  const offset = useRef(new Animated.Value(0)).current;
  const position = useRef(0); const start = useRef(0);
  const [open, setOpen] = useState(false);
  const settle = (value: number) => {
    position.current = value; setOpen(value > 0);
    Animated.timing(offset, { toValue: value, duration: 150, useNativeDriver: true }).start();
  };
  const gesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, event) => enabled && Math.abs(event.dx) > DRAG_THRESHOLD
      && Math.abs(event.dx) > Math.abs(event.dy),
    onPanResponderGrant: () => { offset.stopAnimation(); start.current = position.current; setOpen(true); },
    onPanResponderMove: (_, event) => {
      position.current = Math.max(0, Math.min(ACTION_WIDTH, start.current + event.dx));
      offset.setValue(position.current);
    },
    onPanResponderRelease: () => settle(position.current > ACTION_WIDTH / 2 ? ACTION_WIDTH : 0),
    onPanResponderTerminate: () => settle(0),
  }), [enabled, offset]);
  return <View style={styles.container} {...gesture.panHandlers}>
    {enabled && open && <Pressable accessibilityRole="button" style={styles.action}
      onPress={() => { settle(0); remove(); }}><Text style={styles.label}>{t('client.lounge.deleteChat')}</Text></Pressable>}
    <Animated.View style={[styles.content, { transform: [{ translateX: offset }] }]}>{children}</Animated.View>
  </View>;
}
