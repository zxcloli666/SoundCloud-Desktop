import { memo, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../../lib/perf';
import { TIER_FILLS } from '../../layout/StarBadge';
import { CORE_PERKS, FRESH_PERKS, type FreshPerkKey } from './meta';

type PerkIcon = ComponentType<{ size?: number; className?: string }>;

const ACCENT_TILE = {
  background: 'color-mix(in srgb, var(--color-accent) 13%, transparent)',
  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 22%, transparent)',
};

export const PerkGrid = memo(function PerkGrid() {
  return (
    <div className="mt-4 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {FRESH_PERKS.map(({ key, Icon }) => (
          <FreshPerk key={key} id={key} Icon={Icon} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {CORE_PERKS.map(({ key, Icon }) => (
          <CorePerk key={key} id={key} Icon={Icon} />
        ))}
      </div>
    </div>
  );
});

const FreshPerk = memo(function FreshPerk({ id, Icon }: { id: FreshPerkKey; Icon: PerkIcon }) {
  const { t } = useTranslation();
  return (
    <div
      className="relative overflow-hidden rounded-[14px] p-3"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 11%, transparent), transparent 70%), rgb(var(--ink) / 0.025)',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 26%, transparent)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px]" style={ACCENT_TILE}>
          <Icon size={16} className="text-accent" />
        </span>
        <PerkDemo id={id} />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="truncate text-[13px] font-semibold text-ink-90">
          {t(`starpass.perk.${id}.title`)}
        </span>
        <span className="shrink-0 rounded-full bg-accent px-1.5 py-px font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] text-accent-contrast">
          {t('starpass.perk.fresh')}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-ink-45">{t(`starpass.perk.${id}.tag`)}</div>
    </div>
  );
});

const CorePerk = memo(function CorePerk({ id, Icon }: { id: string; Icon: PerkIcon }) {
  const { t } = useTranslation();
  return (
    <div
      title={t(`starpass.perk.${id}.tag`)}
      className="flex flex-col items-start gap-2 rounded-[12px] border border-ink/[0.07] bg-ink/[0.02] p-2.5"
    >
      <span className="grid size-[26px] shrink-0 place-items-center rounded-[8px]" style={ACCENT_TILE}>
        <Icon size={13} className="text-accent" />
      </span>
      <span className="text-[11.5px] font-medium leading-tight text-ink-85">
        {t(`starpass.perk.${id}.title`)}
      </span>
    </div>
  );
});

const BARS = [0.45, 0.8, 1, 0.65, 0.35];

const PerkDemo = memo(function PerkDemo({ id }: { id: FreshPerkKey }) {
  const moving = usePerfMode().idleAnim;
  if (id === 'effects') {
    return (
      <span aria-hidden className="flex h-6 shrink-0 items-end gap-[3px]">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={`w-[3px] origin-bottom rounded-full bg-accent ${moving ? 'perk-bars' : ''}`}
            style={{ height: `${h * 100}%`, animationDelay: `${i * 0.14}s` }}
          />
        ))}
      </span>
    );
  }
  if (id === 'streak') {
    return (
      <span aria-hidden className="flex shrink-0 items-center -space-x-1">
        {TIER_FILLS.map((fill, i) => (
          <span
            key={fill}
            className="size-3.5 rounded-full ring-2 ring-[rgb(var(--surface))]"
            style={{ background: fill, zIndex: i }}
          />
        ))}
      </span>
    );
  }
  if (id === 'releases') {
    return (
      <span aria-hidden className="relative shrink-0">
        <span className="flex -space-x-2.5">
          {[0.5, 0.75, 1].map((a) => (
            <span
              key={a}
              className="size-6 rounded-[6px] ring-2 ring-[rgb(var(--surface))]"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, var(--color-accent) ${a * 70}%, transparent), rgb(var(--ink) / ${0.08 * a}))`,
              }}
            />
          ))}
        </span>
        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-accent ring-2 ring-[rgb(var(--surface))]" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent ${
        moving ? 'perk-sync-dot' : ''
      }`}
    >
      +3
    </span>
  );
});
