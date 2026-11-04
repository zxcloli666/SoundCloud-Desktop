import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Embed } from '../../../lib/chat/types';
import { art } from '../../../lib/formatters';
import { Check, ListPlus, Loader2 } from '../../../lib/icons';
import { queueSuggestion } from '../../../lib/together/room-actions';
import { isRoomHost, useTogetherStore } from '../../../stores/together';

type QueueState = 'idle' | 'busy' | 'done';

function QueueButton({ urn }: { urn: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<QueueState>('idle');
  const queue = () => {
    setState('busy');
    void queueSuggestion(urn).then((ok) => setState(ok ? 'done' : 'idle'));
  };

  if (state === 'done') {
    return (
      <span className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-emerald-300/[0.12] px-2.5 text-[11.5px] font-semibold text-emerald-200">
        <Check size={12} strokeWidth={3} />
        {t('chat.room.suggest.queued')}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={state === 'busy'}
      onClick={queue}
      className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3 text-[11.5px] font-semibold text-accent-contrast transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-default disabled:opacity-70"
    >
      {state === 'busy' ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <ListPlus size={12} strokeWidth={2.4} />
      )}
      {t('chat.room.suggest.queue')}
    </button>
  );
}

export const SuggestCard = memo(function SuggestCard({ track, by }: { track: Embed; by: string }) {
  const { t } = useTranslation();
  const host = useTogetherStore(isRoomHost);
  const playing = useTogetherStore((state) => state.room?.playback.trackUrn === track.urn);
  const cover = art(track.artworkUrl, 't200x200');

  return (
    <div className="flex justify-center px-4 pt-3 pb-1">
      <div className="w-full max-w-[300px] rounded-2xl border border-ink/[0.07] bg-ink/[0.035] p-2.5">
        <div className="flex items-center gap-2.5">
          <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-ink/[0.06]">
            {cover && <img src={cover} alt="" className="size-full object-cover" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink-90">
              {track.title}
            </span>
            {track.artist && (
              <span className="block truncate text-[11.5px] text-ink-45">{track.artist}</span>
            )}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[11px] text-ink-40">
            {t('chat.room.suggest.by', { name: by })}
          </span>
          {playing ? (
            <span className="shrink-0 text-[11.5px] font-semibold text-accent">
              {t('chat.room.suggest.playing')}
            </span>
          ) : (
            host && <QueueButton urn={track.urn} />
          )}
        </div>
      </div>
    </div>
  );
});
