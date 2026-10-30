import { ComposerDictation as SharedDictation } from '../../../../../shared/chat/dictation/ComposerDictation';
import { dictationClient } from './dictation/client';

export function ComposerDictation(props: {
  active: boolean; disabled: boolean; onText: (text: string) => void; onBusyChange: (busy: boolean) => void;
}) {
  return <SharedDictation {...props} client={dictationClient} />;
}
