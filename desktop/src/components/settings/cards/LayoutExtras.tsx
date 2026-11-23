import { arrayMove } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { ListMusic, X } from '../../../lib/icons';
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
