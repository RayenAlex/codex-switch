import { useEffect, useRef, useState } from 'react';
import { ScrollView, type LayoutChangeEvent } from 'react-native';
import { revealTabOffset, tabOverflow, type TabBounds } from '../../../../../shared/tabs/overflow';

export function useTabOverflow(ids: string[], selected: string | null) {
  const viewport = useRef<ScrollView>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [bounds, setBounds] = useState<Record<string, TabBounds>>({});
  const tabs = ids.flatMap(id => bounds[id] ? [bounds[id]] : []);
  const state = tabOverflow({ tabs, barWidth, viewportWidth, contentWidth, scrollLeft });
  const active = selected ? bounds[selected] : undefined;
  useEffect(() => {
    if (!active || !viewportWidth) return;
    viewport.current?.scrollTo({ x: revealTabOffset(active, viewportWidth, scrollLeft), animated: false });
  }, [selected, active?.left, active?.width, viewportWidth]);
  const layout = (id: string, event: LayoutChangeEvent) => {
    const { x: left, width } = event.nativeEvent.layout;
    setBounds(previous => previous[id]?.left === left && previous[id]?.width === width ? previous
      : { ...previous, [id]: { id, left, width } });
  };
  return { ...state, viewport, viewportWidth, layout, setBarWidth, setViewportWidth, setContentWidth, setScrollLeft };
}
