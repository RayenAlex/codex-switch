import { useEffect, useRef } from 'react';
import { ChevronDown, Languages } from 'lucide-react';
import type { Language } from '@remoteai/i18n/website-content/types';
import { languageLabels, languageNames, ui } from '@remoteai/i18n/website-content/ui-text';
import { href, languages, languageTags } from '../lib/site';

export function LanguageMenu({ language, path }: { language: Language; path: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) {
        menu.current.open = false;
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !menu.current?.open) return;
      menu.current.open = false;
      menu.current.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  const target = path === '404/' ? '' : path;
  return <details ref={menu} className="language-switch">
    <summary aria-label={ui(language, 'languageSwitch')}>
      <Languages size={17} aria-hidden="true" />
      <span lang={languageTags[language]}>{languageLabels[language]}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </summary>
    <nav className="language-options" aria-label={ui(language, 'languageSwitch')}>
      {languages.filter(other => other !== language).map(other => <a key={other} className="language-link"
        href={href(other, target)} lang={languageTags[other]} hrefLang={languageTags[other]}
        title={languageNames[other] === languageLabels[other] ? undefined : languageNames[other]}>
        {languageLabels[other]}
      </a>)}
    </nav>
  </details>;
}
