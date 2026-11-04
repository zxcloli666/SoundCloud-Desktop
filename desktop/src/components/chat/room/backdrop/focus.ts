import { type RefObject, useEffect } from 'react';

export function useFocusInside(ref: RefObject<HTMLElement | null>, selectors: readonly string[]) {
  useEffect(() => {
    const root = ref.current;
    const card = root?.closest<HTMLElement>('[role="dialog"]');
    if (!root || !card) return;
    const enter = () => {
      for (const selector of selectors) {
        const target = root.querySelector<HTMLElement>(selector);
        if (target) return target.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target === card) enter();
    };
    card.addEventListener('focus', onFocus);
    if (document.activeElement === card) enter();
    return () => card.removeEventListener('focus', onFocus);
  }, [ref, selectors]);
}
