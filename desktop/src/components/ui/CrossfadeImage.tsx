import React, { type CSSProperties, useCallback, useEffect, useState } from 'react';

const FADE_MS = 1400;

interface Layers {
  top: string;
  under: string | null;
}

export const CrossfadeImage = React.memo(
  ({
    src,
    fade,
    className,
    style,
  }: {
    src: string;
    fade: boolean;
    className?: string;
    style?: CSSProperties;
  }) => {
    const [layers, setLayers] = useState<Layers>({ top: src, under: null });

    useEffect(() => {
      let cancelled = false;
      const img = new Image();
      img.src = src;
      img
        .decode()
        .catch(() => undefined)
        .then(() => {
          if (cancelled) return;
          setLayers((l) => (l.top === src ? l : { top: src, under: fade ? l.top : null }));
        });
      return () => {
        cancelled = true;
      };
    }, [src, fade]);

    const under = layers.under;
    const fadeIn = useCallback(
      (el: HTMLImageElement | null) => {
        if (!el || !under) return;
        const opacity = getComputedStyle(el).opacity;
        el.animate([{ opacity: 0 }, { opacity }], { duration: FADE_MS, easing: 'ease-in-out' })
          .finished.catch(() => undefined)
          .then(() => setLayers((l) => (l.under === under ? { top: l.top, under: null } : l)));
      },
      [under],
    );

    return (
      <>
        {under && (
          <img
            key={under}
            src={under}
            alt=""
            aria-hidden="true"
            decoding="async"
            className={className}
            style={style}
          />
        )}
        <img
          key={layers.top}
          ref={fadeIn}
          src={layers.top}
          alt=""
          aria-hidden="true"
          decoding="async"
          className={className}
          style={style}
        />
      </>
    );
  },
);
