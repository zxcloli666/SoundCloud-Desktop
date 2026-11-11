import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { fc } from '../../lib/formatters';
import { Heart, ListMusic, Users } from '../../lib/icons';
import { likedTracksCount } from '../../lib/likes';
import { useAuthStore } from '../../stores/auth';
import type { WaitScope } from './scope';

const CHIPS = [
  { id: 'likes', Icon: Heart, label: 'library.likedTracks' },
  { id: 'playlists', Icon: ListMusic, label: 'library.yourPlaylists' },
  { id: 'followings', Icon: Users, label: 'library.artists' },
] as const;

const LIT = {
  background: 'color-mix(in srgb, var(--color-accent) 13%, transparent)',
  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 30%, transparent)',
};

const DIM = {
  background: 'rgb(var(--ink) / 0.045)',
  boxShadow: 'inset 0 0 0 1px rgb(var(--ink) / 0.06)',
};

export const WaitChips = memo(function WaitChips({ scope }: { scope: WaitScope }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const counts = {
    likes: likedTracksCount(user) ?? 0,
    playlists: user?.playlist_count ?? 0,
    followings: user?.followings_count ?? 0,
  };
  const current = scope === 'tracks' ? 'playlists' : scope;

  return (
    <div className="flex flex-wrap gap-1.5">
      {CHIPS.filter(({ id }) => counts[id] > 0).map(({ id, Icon, label }) => (
        <span
          key={id}
          title={t(label)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums ${
            id === current ? 'text-accent' : 'text-ink-55'
          }`}
          style={id === current ? LIT : DIM}
        >
          <Icon size={12} />
          {fc(counts[id])}
        </span>
      ))}
    </div>
  );
});
