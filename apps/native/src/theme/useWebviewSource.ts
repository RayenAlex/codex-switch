import { useMemo, useRef } from 'react';
import { themedWebviewDocument, type WebviewAppearance } from '../../../../shared/theme/webviewDocument';

/** Live theme changes go through the bridge; replacing source would discard drafts and scrollback. */
export function useWebviewSource(html: string, appearance: WebviewAppearance, generation = 0) {
  const latest = useRef(appearance);
  latest.current = appearance;
  return useMemo(() => ({ html: themedWebviewDocument(html, latest.current) }), [html, generation]);
}
