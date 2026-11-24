import { type RefObject, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';

const SCREENS_BEFORE_SHOWN = 2;
const EDGE_GAP = 24;

export function BackToTop({ target }: { target: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const [shown, setShown] = useState(false);
  const [right, setRight] = useState(EDGE_GAP);

  useEffect(() => {
    const main = target.current;
    if (!main) return;
    const onScroll = () => setShown(main.scrollTop > main.clientHeight * SCREENS_BEFORE_SHOWN);
    const onResize = () =>
      setRight(window.innerWidth - main.getBoundingClientRect().right + EDGE_GAP);
    onScroll();
    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(main);
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      main.removeEventListener('scroll', onScroll);
    };
  }, [target]);

  const scrollUp = () => {
    const calm = !perf.idleAnim || matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.current?.scrollTo({ top: 0, behavior: calm ? 'instant' : 'smooth' });
  };

  return (
    <button
      type="button"
      data-ui="back-to-top"
      aria-label={t('common.backToTop')}
      title={t('common.backToTop')}
      tabIndex={shown ? 0 : -1}
      onClick={scrollUp}
      style={{ right }}
      className={`fixed bottom-[calc(var(--dock-height)+17px)] z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-ink/[0.10] bg-surface/96 text-ink-70 shadow-[0_8px_24px_rgb(var(--shade)/calc(0.5*var(--shade-alpha)))] transition-[transform,opacity,color] duration-200 ease-[var(--ease-apple)] hover:text-accent active:scale-95 motion-reduce:transition-none ${
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <ArrowUp size={16} />
    </button>
  );
}
