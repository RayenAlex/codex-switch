import { useMemo, useRef, useState } from 'react';
import { PanResponder, type View } from 'react-native';
import { isSettingDrag, settingSegmentAt } from '../../../../shared/remote-chat/settingSegments';

/** Preview while dragging; save once on release, and discard interrupted gestures. */
export function useSettingSegmentDrag(count: number, select: (index: number) => void) {
  const track = useRef<View>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const latest = useRef({ count, select });
  latest.current = { count, select };
  const gesture = useRef({ left: 0, width: 0, active: false });
  const responder = useMemo(() => {
    const indexAt = (pageX: number) => settingSegmentAt(
      pageX - gesture.current.left, gesture.current.width, latest.current.count,
    );
    const cancel = () => {
      gesture.current.active = false;
      setPreview(null);
    };
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_event, state) => (
        state.numberActiveTouches === 1 && latest.current.count > 1 && isSettingDrag(state.dx, state.dy)
      ),
      onPanResponderGrant: (_event, state) => {
        gesture.current.active = true;
        const pageX = state.moveX;
        track.current?.measureInWindow((left, _top, width) => {
          if (!gesture.current.active) return;
          gesture.current.left = left;
          gesture.current.width = width;
          setPreview(indexAt(pageX));
        });
      },
      onPanResponderMove: (_event, state) => {
        if (state.numberActiveTouches !== 1) return cancel();
        if (gesture.current.active) setPreview(indexAt(state.moveX));
      },
      onPanResponderRelease: (_event, state) => {
        const index = gesture.current.active ? indexAt(state.moveX) : null;
        cancel();
        if (index !== null) latest.current.select(index);
      },
      onPanResponderStart: (_event, state) => { if (state.numberActiveTouches > 1) cancel(); },
      onPanResponderTerminate: cancel,
      onPanResponderTerminationRequest: () => true,
    });
  }, []);
  return { track, preview, panHandlers: responder.panHandlers };
}
