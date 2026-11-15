import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PERKS } from '../meta';

export const PerkChips = memo(function PerkChips({
  lit = false,
  center = false,
}: {
  lit?: boolean;
  center?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-ui="star-perks"
      className={`flex flex-wrap gap-1.5 ${center ? 'justify-center' : ''}`}
    >
      {PERKS.map(({ key, Icon }) => (
        <span
          key={key}
          title={t(`starpass.perk.${key}.tag`)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink/[0.08] bg-ink/[0.035] pl-1.5 pr-3 text-[12px] font-medium text-ink-75"
        >
          <span
            className="grid size-5 place-items-center rounded-full"
            style={{
              background: lit
                ? 'var(--color-accent)'
                : 'color-mix(in srgb, var(--color-accent) 16%, transparent)',
            }}
          >
            <Icon size={11} className={lit ? 'text-accent-contrast' : 'text-accent'} />
          </span>
          {t(`starpass.perk.${key}.title`)}
        </span>
      ))}
    </div>
  );
});
