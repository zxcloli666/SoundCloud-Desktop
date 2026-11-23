import { arrayMove } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Check, ListMusic, X } from '../../../lib/icons';
import {
  RIVER_SECTIONS,
  type RiverSectionId,
  resolveRiverHidden,
  toggleRiverSection,
} from '../../../lib/layout';
import { useSettingsStore } from '../../../stores/settings';
import { LayoutList, RowIconButton } from './LayoutList';

export function SubHeading({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <div className="text-[13.5px] font-medium text-ink-90">{title}</div>
      {desc && <p className="mt-0.5 text-[12px] leading-snug text-ink-45">{desc}</p>}
    </div>
  );
}

function Cover({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" className="h-full w-full object-cover" decoding="async" />
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
    <div data-ui="settings-row" className="set-row space-y-2.5 py-3">
      <SubHeading title={t('settings.layoutPinned')} />
      {pinned.length === 0 ? (
        <p className="text-[12px] text-ink-40">{t('settings.layoutPinnedEmpty')}</p>
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
  const saved = useSettingsStore((s) => s.riverHidden);
  const setHidden = useSettingsStore((s) => s.setRiverHidden);
  const hidden = resolveRiverHidden(saved);

  const toggle = (id: RiverSectionId) => setHidden(toggleRiverSection(saved, id));

  return (
    <div data-ui="settings-row" className="set-row space-y-2.5 py-3">
      <SubHeading
        title={t('settings.layoutRiverSections')}
        desc={t('settings.layoutRiverSectionsDesc')}
      />
      <div className="flex flex-wrap gap-2">
        {RIVER_SECTIONS.map((id) => {
          const on = !hidden.has(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(id)}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-150 ${
                on
                  ? 'border-accent bg-accent/[0.1] text-ink'
                  : 'border-[color:var(--set-line)] bg-[var(--set-well)] text-ink-50 hover:text-ink'
              }`}
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
