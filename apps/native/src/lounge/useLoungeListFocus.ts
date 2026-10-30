import { useEffect, useRef, type RefObject } from 'react';
import type { FlatList } from 'react-native';
import { historyKey } from '../../../../shared/lounge/archive';
import type { LoungeMessage } from '../../../../shared/lounge/types';

const RETRY_DELAY_MS = 150;
const MAX_SCROLL_ATTEMPTS = 6;

/** Virtualized rows need an approximate scroll before an unmeasured original can be centered. */
export function useLoungeListFocus({ list, messages, focus }: {
  list: RefObject<FlatList<LoungeMessage> | null>; messages: LoungeMessage[];
  focus?: { key: string; request: number };
}) {
  const latest = useRef({ messages, focus }); latest.current = { messages, focus };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const attempts = useRef(0);
  const reveal = () => {
    const current = latest.current;
    if (!current.focus || attempts.current >= MAX_SCROLL_ATTEMPTS) return;
    const index = current.messages.findIndex(message => historyKey(message) === current.focus!.key);
    if (index < 0) return;
    attempts.current++;
    list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
  };
  useEffect(() => {
    attempts.current = 0;
    timer.current = setTimeout(reveal, 0);
    return () => clearTimeout(timer.current);
  }, [focus]);
  const failed = (info: { index: number; averageItemLength: number }) => {
    if (!latest.current.focus || attempts.current >= MAX_SCROLL_ATTEMPTS) return;
    list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    clearTimeout(timer.current); timer.current = setTimeout(reveal, RETRY_DELAY_MS);
  };
  return { reveal, failed };
}
