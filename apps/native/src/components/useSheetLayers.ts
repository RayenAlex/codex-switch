import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const SheetLayerContext = createContext<((open: boolean) => void) | null>(null);

/** React Native modal responder events can cross into the parent sheet's React tree. */
export function useSheetLayers(visible: boolean) {
  const parent = useContext(SheetLayerContext);
  const [children, setChildren] = useState(0);
  const register = useCallback((open: boolean) => setChildren(count => Math.max(0, count + (open ? 1 : -1))), []);
  useEffect(() => {
    if (!visible || !parent) return;
    parent(true);
    return () => parent(false);
  }, [parent, visible]);
  return { covered: children > 0, register };
}
