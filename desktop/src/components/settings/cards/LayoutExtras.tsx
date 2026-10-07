import { arrayMove } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Check, ListMusic, X } from '../../../lib/icons';
import { RIVER_SECTIONS, type RiverSectionId } from '../../../lib/layout';
import { useSettingsStore } from '../../../stores/settings';
import { LayoutList, RowIconButton } from './LayoutList';

function SubHeading({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex items-baseline gap-3 px-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/35 whitespace-nowrap">
        {title}
      </span>
      {desc && <span className="truncate text-[11px] text-white/25">{desc}</span>}
      <span className="h-px flex-1 bg-white/[0.05]" />
    </div>
  );
}

function Cover({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" className="w-8 h-8 rounded-xl object-cover" decoding="async" />
  ) : (
    <ListMusic size={16} />
  );
}

export function PinnedEditor() {
  const { t } = useTranslation();
  const pinned = useSettingsStore((s) => s.pinnedPlaylists);
  const reorder = useSettingsStore((s) => s.reorderPinnedPlaylists);
  const unpin = useSettingsStore((s) => s.unpinPlaylist);
  const urns = pinned.map((p) => p.urn);

  return (
    <div className="space-y-2.5">
      <SubHeading title={t('settings.layoutPinned')} />
      {pinned.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-4 text-center text-[12px] text-white/30">
          {t('settings.layoutPinnedEmpty')}
        </div>
      ) : (
        <LayoutList
          onMove={(from, to) => reorder(arrayMove(urns, urns.indexOf(from), urns.indexOf(to)))}
          items={pinned.map((p) => ({
            id: p.urn,
            icon: <Cover src={art(p.artworkUrl, 'small')} />,
            label: p.title,
            trailing: (
              <RowIconButton label={t('settings.layoutUnpin')} onClick={() => unpin(p.urn)}>
                <X size={15} />
              </RowIconButton>
            ),
          }))}
        />
      )}
    </div>
  );
}

export function RiverSections() {
  const { t } = useTranslation();
  const hidden = useSettingsStore((s) => s.riverHidden);
  const setHidden = useSettingsStore((s) => s.setRiverHidden);

  const toggle = (id: RiverSectionId) =>
    setHidden(hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]);

  return (
    <div className="space-y-2.5">
      <SubHeading
        title={t('settings.layoutRiverSections')}
        desc={t('settings.layoutRiverSectionsDesc')}
      />
      <div className="flex flex-wrap gap-2">
        {RIVER_SECTIONS.map((id) => {
          const on = !hidden.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(id)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12px] font-medium transition-all duration-200 cursor-pointer ${
                on
                  ? 'text-white'
                  : 'text-white/35 border-white/[0.06] bg-white/[0.02] hover:text-white/60 hover:bg-white/[0.05]'
              }`}
              style={
                on
                  ? {
                      background:
                        'linear-gradient(180deg, var(--color-accent-glow), transparent), rgba(255,255,255,0.05)',
                      borderColor: 'var(--color-accent)',
                      boxShadow: '0 0 14px var(--color-accent-glow)',
                    }
                  : undefined
              }
            >
              {on && <Check size={12} />}
              {t(`soundwave.home.cluster.${id}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
