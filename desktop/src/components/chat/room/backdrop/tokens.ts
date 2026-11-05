import { useMemo, useSyncExternalStore } from 'react';
import { activeScheme, type Scheme } from '../../../../lib/scheme';
import type { SchemeTokens } from './scrim';

const NAMES = ['--ink', '--paper', '--ink-lift'] as const;

function snapshot(): string {
  const style = getComputedStyle(document.documentElement);
  return [activeScheme(), ...NAMES.map((name) => style.getPropertyValue(name).trim())].join('|');
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true });
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

export function useSchemeTokens(): SchemeTokens {
  const raw = useSyncExternalStore(subscribe, snapshot);
  return useMemo(() => {
    const [scheme, ink, paper, lift] = raw.split('|');
    return { scheme: scheme as Scheme, ink, paper, lift };
  }, [raw]);
}
