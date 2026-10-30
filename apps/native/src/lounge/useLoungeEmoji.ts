import { useEffect, useRef, useState, type RefObject } from 'react';
import { BackHandler, Keyboard, Platform, type TextInput, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { insertLoungeEmoji, loungeEmojiPanelHeight } from '../../../../shared/lounge/emoji';

export function useLoungeEmoji({ input, text, setText, viewportHeight }: {
  input: RefObject<TextInput | null>; text: string; setText: (text: string) => void; viewportHeight: number;
}) {
  const [open, setOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(Keyboard.metrics()?.height ?? 0);
  const [keyboardSize, setKeyboardSize] = useState({ height: 0, width: 0 });
  const [selection, setSelection] = useState({ start: text.length, end: text.length });
  const latestSelection = useRef(selection);
  const { height, width } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const fullViewport = useRef({ height: viewportHeight, width });
  fullViewport.current = { width, height: fullViewport.current.width === width
    ? Math.max(fullViewport.current.height, viewportHeight) : viewportHeight };
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', event => {
      setKeyboardHeight(event.endCoordinates.height);
      setKeyboardSize({ height: Math.max(0, event.endCoordinates.height - bottom), width });
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, [bottom, width]);
  useEffect(() => {
    if (!open) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { setOpen(false); return true; });
    return () => back.remove();
  }, [open]);
  const changeSelection = (next: typeof selection) => { latestSelection.current = next; setSelection(next); };
  const insert = (emoji: string) => {
    const next = insertLoungeEmoji(text, latestSelection.current, emoji);
    changeSelection(next.selection);
    setText(next.text);
  };
  const toggle = () => {
    if (open) { setOpen(false); input.current?.focus(); return; }
    const metrics = Keyboard.metrics();
    // Some Android IMEs report their opening animation's height only. The resized page is authoritative.
    const measuredHeight = Platform.OS === 'android' ? fullViewport.current.height - viewportHeight : 0;
    if (measuredHeight > 0 || metrics) setKeyboardSize({
      height: measuredHeight || Math.max(0, (metrics?.height ?? 0) - bottom), width,
    });
    input.current?.blur(); Keyboard.dismiss(); setOpen(true);
  };
  // Android resizes the window for the IME. Wait for its dismissal before occupying the same space.
  const rememberedHeight = keyboardSize.width === width ? keyboardSize.height : 0;
  const panelHeight = keyboardHeight ? 0 : loungeEmojiPanelHeight(height, rememberedHeight);
  return { open, close: () => setOpen(false), toggle, insert, selection, changeSelection, panelHeight };
}
