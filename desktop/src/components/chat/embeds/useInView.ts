import { type RefObject, useEffect, useRef, useState } from 'react';

const listeners = new WeakMap<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | null = null;

function sharedObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
    },
    { rootMargin: '160px 0px' },
  );
  return observer;
}

export function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const shared = sharedObserver();
    listeners.set(element, setVisible);
    shared.observe(element);
    return () => {
      shared.unobserve(element);
      listeners.delete(element);
    };
  }, []);

  return [ref, visible];
}
