import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ProviderGlyph } from '../ProviderGlyph';
import type { ActivationKind, MethodTile } from '../providers';

export const MethodTiles = memo(function MethodTiles({
  tiles,
  selected,
  onSelect,
}: {
  tiles: MethodTile[];
  selected: ActivationKind | null;
  onSelect: (kind: ActivationKind) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tiles.map((tile) => {
        const on = tile.kind === selected;
        return (
          <button
            key={tile.kind}
            type="button"
            onClick={() => onSelect(tile.kind)}
            className="cursor-pointer rounded-[13px] border p-3 text-left transition-all duration-200 ease-[var(--ease-apple)] hover:-translate-y-0.5"
            style={{
              borderColor: on
                ? 'color-mix(in srgb, var(--color-accent) 60%, transparent)'
                : 'rgb(var(--ink) / 0.10)',
              background: 'rgb(var(--ink) / 0.025)',
              boxShadow: on
                ? '0 0 24px -8px var(--color-accent-glow), inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent)'
                : undefined,
            }}
          >
            <span className="mb-2.5 grid size-[30px] place-items-center rounded-[9px] border border-ink/[0.08] bg-ink/[0.04]">
              <ProviderGlyph kind={tile.kind} />
            </span>
            <div className="text-[12.5px] font-semibold text-ink-90">
              {t(`starpass.method.${tile.i18n}.title`)}
            </div>
            <div className="mt-0.5 font-mono text-[9px] tracking-[0.06em] text-ink-40">
              {tile.tag}
            </div>
          </button>
        );
      })}
    </div>
  );
});
