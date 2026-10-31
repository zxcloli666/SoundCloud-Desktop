import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/shallow';
import { MapPin } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { type SidebarPinnedArtist, useSettingsStore } from '../../stores/settings';

export function PinArtistButton({ artist }: { artist: SidebarPinnedArtist }) {
  const { t } = useTranslation();
  const blur = usePerfMode().blur(20);
  const { pinned, pinArtist, unpinArtist, refreshPinnedArtist } = useSettingsStore(
    useShallow((s) => ({
      pinned: s.pinnedArtists.find((item) => item.id === artist.id),
      pinArtist: s.pinArtist,
      unpinArtist: s.unpinArtist,
      refreshPinnedArtist: s.refreshPinnedArtist,
    })),
  );

  const { id, name, avatarUrl, path } = artist;
  const stale =
    !!pinned && (pinned.name !== name || pinned.avatarUrl !== avatarUrl || pinned.path !== path);

  useEffect(() => {
    if (stale) refreshPinnedArtist({ id, name, avatarUrl, path });
  }, [stale, refreshPinnedArtist, id, name, avatarUrl, path]);

  const toggle = useCallback(() => {
    if (pinned) {
      unpinArtist(id);
      toast.success(t('sidebar.artistUnpinned'));
      return;
    }
    pinArtist({ id, name, avatarUrl, path });
    toast.success(t('sidebar.artistPinned'));
  }, [pinned, unpinArtist, pinArtist, id, name, avatarUrl, path, t]);

  const label = pinned ? t('sidebar.unpinArtist') : t('sidebar.pinArtist');
  const idleBg =
    blur > 0
      ? 'bg-ink/[0.04] hover:bg-ink/[0.08]'
      : 'bg-[rgb(var(--surface-hi)/0.85)] hover:bg-[rgb(var(--surface-hi)/0.9)]';

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={!!pinned}
      className={`inline-flex items-center gap-1.5 h-11 px-5 rounded-full border-[0.5px] text-[12px] font-medium transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer ${
        pinned
          ? 'bg-accent/15 border-accent/30 text-accent hover:bg-accent/20'
          : `${idleBg} border-ink/[0.08] text-ink-50 hover:text-ink-80 hover:border-ink/[0.14]`
      }`}
      style={{
        backdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      <MapPin size={15} />
      {pinned ? t('sidebar.pinnedArtist') : t('sidebar.pinArtistShort')}
    </button>
  );
}
