import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlaylist } from '../../../lib/hooks';
import { Heart, InfinityLoop, ListMusic, ListPlus, Radio, Star, Waves } from '../../../lib/icons';
import type { QueueContext, QueueContextKind } from '../../../lib/queue-context';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import type { QueueGroup } from './queue-items';

type Icon = typeof Heart;

const CONTEXT_ICON: Record<QueueContextKind, Icon> = {
  wave: Waves,
  artistWave: Waves,
  similar: Radio,
  likes: Heart,
  superlikes: Star,
  playlist: ListMusic,
};

const CONTEXT_LABEL: Record<Exclude<QueueContextKind, 'playlist'>, string> = {
  wave: 'queue.fromWave',
  artistWave: 'queue.fromArtistWave',
  similar: 'queue.fromSimilar',
  likes: 'queue.fromLikes',
  superlikes: 'queue.fromSuperlikes',
};

function contextLabel(t: TFunction, context: QueueContext | null, playlistTitle?: string) {
  if (!context) return t('flowRedesign.upNext');
  if (context.kind !== 'playlist') return t(CONTEXT_LABEL[context.kind]);
  return playlistTitle
    ? t('queue.fromPlaylist', { name: playlistTitle })
    : t('queue.fromPlaylistAny');
}

function useSectionLabel(group: QueueGroup): { label: string; Icon: Icon } {
  const { t } = useTranslation();
  const context = usePlayerStore((s) => s.queueContext);
  const playlist = usePlaylist(
    group === 'context' && context?.kind === 'playlist' ? context.id : undefined,
  );
  if (group === 'added') return { label: t('queue.added'), Icon: ListPlus };
  if (group === 'auto') return { label: t('player.autoplay'), Icon: InfinityLoop };
  return {
    label: contextLabel(t, context, playlist.data?.title),
    Icon: context ? CONTEXT_ICON[context.kind] : ListMusic,
  };
}

function AutoplaySwitch() {
  const { t } = useTranslation();
  const autoplay = useSettingsStore((s) => s.autoplay);
  const setAutoplay = useSettingsStore((s) => s.setAutoplay);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={autoplay}
      aria-label={t('player.autoplay')}
      title={autoplay ? t('player.autoplayOn') : t('player.autoplayOff')}
      onClick={() => setAutoplay(!autoplay)}
      className="queue-switch"
    />
  );
}

interface Props {
  group: QueueGroup;
  count: number;
  autoplay: boolean;
}

export const QueueSection = React.memo(function QueueSection({ group, count, autoplay }: Props) {
  const { label, Icon } = useSectionLabel(group);
  return (
    <div
      data-ui="queue-section"
      data-group={group}
      className="flex h-full items-end gap-2 px-2 pb-2"
    >
      <Icon size={13} className="mb-px shrink-0 text-ink-40" />
      <span className="min-w-0 truncate text-[12.5px] font-semibold tracking-[-0.005em] text-ink-70">
        {label}
      </span>
      {count > 0 && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-30">{count}</span>
      )}
      <span className="flex-1" />
      {autoplay && <AutoplaySwitch />}
    </div>
  );
});

export function AutoplayHint() {
  const { t } = useTranslation();
  const autoplay = useSettingsStore((s) => s.autoplay);
  return (
    <p className="flex h-full items-start px-2 pt-0.5 text-[12px] leading-snug text-ink-40">
      {autoplay ? t('player.autoplayOn') : t('player.autoplayOff')}
    </p>
  );
}
