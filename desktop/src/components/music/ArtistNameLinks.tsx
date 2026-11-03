import React from 'react';
import {useNavigate} from 'react-router-dom';
import type {ArtistLinkItem} from '../../lib/track-display';

/**
 * Строка авторов «A, B, C», где каждое имя — отдельная ссылка на СВОЕГО
 * артиста/юзера (item.target из `getArtistLinkItems`). Несматченные имена —
 * обычный текст. stopPropagation — ряды сами кликабельны (play/контекст).
 */
export const ArtistNameLinks = React.memo(function ArtistNameLinks({
  items,
  linkClassName,
}: {
  items: ArtistLinkItem[];
  linkClassName?: string;
}) {
  const navigate = useNavigate();
  return (
    <>
      {items.map((it, i) => {
        const target = it.target;
        const go = target
          ? (e: React.SyntheticEvent) => {
              e.stopPropagation();
              navigate(target);
            }
          : undefined;
        return (
          <React.Fragment key={it.name}>
            {i > 0 && ', '}
            {go ? (
              <span
                role="link"
                tabIndex={0}
                className={linkClassName ?? 'cursor-pointer transition-colors hover:text-ink-85'}
                onClick={go}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') go(e);
                }}
              >
                {it.name}
              </span>
            ) : (
              <span>{it.name}</span>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
});
