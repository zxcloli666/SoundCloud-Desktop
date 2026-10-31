import React from 'react';
import { useTranslation } from 'react-i18next';
import { CornerDownRight } from '../../lib/icons';
import type { RelayRoute, UpstreamState } from '../../lib/net/check';

const DOTS: Record<UpstreamState, string> = {
  ok: 'bg-emerald-400/80',
  backup: 'bg-amber-400/85',
  down: 'bg-rose-400/85',
};

const NAMES: Record<UpstreamState, string> = {
  ok: 'text-ink-45',
  backup: 'text-amber-200/75',
  down: 'text-rose-200/75',
};

export const RouteChips = React.memo(({ route }: { route: RelayRoute }) => {
  const { t } = useTranslation();
  if (route.upstreams.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <CornerDownRight size={11} className="shrink-0 text-ink-20" />
      {route.upstreams.map(({ origin, state }) => {
        const name = t(`netCheck.route.origin.${origin}`, { defaultValue: origin });
        const title = t(`netCheck.route.${state}`, { name });
        return (
          <span
            key={origin}
            className="inline-flex items-center gap-1"
            title={title}
            role="img"
            aria-label={title}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${DOTS[state]}`} />
            <span className={`text-[10.5px] ${NAMES[state]}`}>{name}</span>
          </span>
        );
      })}
    </div>
  );
});
