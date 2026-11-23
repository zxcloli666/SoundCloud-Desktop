import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { art, fc } from '../../lib/formatters';
import { Loader2 } from '../../lib/icons';
import type { Track } from '../../stores/player';
import { RelatedRow } from './RelatedRow';

interface FavUser {
  urn: string;
  username: string;
  avatar_url: string;
}

const PANEL = 'panel rounded-3xl';

export const RoomSleeve = React.memo(function RoomSleeve({
  track,
  favoriters,
  related,
  relatedLoading,
}: {
  track: Track;
  favoriters: FavUser[];
  related: Track[];
  relatedLoading: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const u = track.user;

  const shown = favoriters.slice(0, 8);
  const total = track.favoritings_count ?? track.likes_count ?? favoriters.length;
  const extra = Math.max(0, total - shown.length);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate(`/user/${encodeURIComponent(u.urn)}`)}
        className={`${PANEL} group/ac flex w-full cursor-pointer flex-col items-center gap-3.5 p-6 text-center transition-colors duration-200 hover:border-ink/[0.14] hover:bg-ink/[0.04]`}
      >
        <img
          src={art(u.avatar_url, 't200x200') ?? ''}
          alt=""
          className="h-20 w-20 rounded-full object-cover ring-1 ring-ink/[0.12]"
        />
        <div>
          <p className="text-[15px] font-bold text-ink-90 group-hover/ac:text-ink transition-colors">
            {u.username}
          </p>
          {(u.followers_count != null || u.track_count != null) && (
            <p className="mt-1 text-[11px] tabular-nums text-ink-40">
              {u.followers_count != null && `${fc(u.followers_count)} ${t('user.followers')}`}
              {u.followers_count != null && u.track_count != null && ' · '}
              {u.track_count != null && `${fc(u.track_count)} ${t('user.tracks')}`}
            </p>
          )}
        </div>
      </button>

      {shown.length > 0 && (
        <div className={`${PANEL} p-5`}>
          <h3 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-40">
            {t('track.whoVibes')}
          </h3>
          <div className="flex items-center">
            <div className="flex -space-x-3">
              {shown.map((fu) => (
                <button
                  type="button"
                  key={fu.urn}
                  title={fu.username}
                  onClick={() => navigate(`/user/${encodeURIComponent(fu.urn)}`)}
                  className="relative cursor-pointer hover:z-10"
                >
                  <img
                    src={art(fu.avatar_url, 'small') ?? ''}
                    alt={fu.username}
                    loading="lazy"
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-paper transition-shadow duration-200 hover:ring-ink/30"
                  />
                </button>
              ))}
            </div>
            {extra > 0 && (
              <span className="ml-3.5 text-[12px] font-semibold tabular-nums text-ink-55">
                +{fc(extra)}
              </span>
            )}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-40">
          {t('track.related')}
        </h3>
        {relatedLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={16} className="text-ink-30 animate-spin" />
          </div>
        ) : related.length === 0 ? (
          <p className="px-1 text-[12px] text-ink-40">{t('track.relatedEmpty')}</p>
        ) : (
          <div className="space-y-1">
            {related.map((rt) => (
              <RelatedRow key={rt.urn} track={rt} queue={related} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
