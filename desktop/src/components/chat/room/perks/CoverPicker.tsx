import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomCover } from '../../../../lib/chat/media-types';
import { Check, Loader2, RotateCcw } from '../../../../lib/icons';
import { setRoomCover } from '../../../../lib/together/room-actions';
import type { RoomView } from '../../../../lib/together/types';
import { AccentSwatches } from './AccentSwatches';
import { CoverChoices } from './CoverChoices';
import { type CoverError, CoverIssue, coverError, useCountdown } from './CoverIssue';
import { CoverPreview } from './CoverPreview';
import './keyframes';
import { accentColor, accentInk, coverSrc, validCover } from './perks';
import { StarAction, useStarState } from './StarAction';
import { StarMark } from './StarMark';
import { useArtworkChoices } from './useArtworkChoices';

interface Draft {
  url: string | null;
  accent: number;
}

function focusActiveTile(grid: HTMLDivElement | null) {
  requestAnimationFrame(() => {
    grid?.querySelector<HTMLButtonElement>('[role="radio"][tabindex="0"]')?.focus();
  });
}

export const CoverPicker = memo(function CoverPicker({
  room,
  onSaved,
}: {
  room: RoomView;
  onSaved: (cover: RoomCover | null) => void;
}) {
  const { t } = useTranslation();
  const star = useStarState(room.perks);
  const current = validCover(room.cover);
  const artwork = useArtworkChoices(true);
  const grid = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft>({
    url: current?.url ?? null,
    accent: current?.accent ?? 0,
  });
  const [saving, setSaving] = useState<'set' | 'reset' | null>(null);
  const [error, setError] = useState<CoverError | null>(null);
  const wait = useCountdown(error?.until ?? 0);

  const track = room.playback.track;
  const trackArt = track ? track.artwork_url || track.user?.avatar_url : null;
  const chosen = artwork.choices.find((choice) => choice.url === draft.url) ?? null;
  const src = draft.url ? coverSrc(draft.url) : coverSrc(trackArt);
  const changed =
    draft.url !== null && (draft.url !== current?.url || draft.accent !== current?.accent);

  const select = useCallback((url: string) => {
    setError(null);
    setDraft((prev) => ({ ...prev, url }));
  }, []);

  const pickAccent = useCallback((accent: number) => {
    setDraft((prev) => ({ ...prev, accent }));
  }, []);

  const save = async (cover: RoomCover | null) => {
    setSaving(cover ? 'set' : 'reset');
    const outcome = await setRoomCover(cover);
    setSaving(null);
    if (outcome.ok) {
      setError(null);
      onSaved(cover);
      return;
    }
    setError((prev) => coverError(outcome.code, outcome.retryMs, prev));
  };

  const apply = () => {
    if (draft.url) void save({ url: draft.url, accent: draft.accent });
  };

  const pickOther = () => {
    setError(null);
    setDraft((prev) => ({ ...prev, url: null }));
    focusActiveTile(grid.current);
  };

  return (
    <div data-ui="room-cover-picker" className="flex min-h-0 flex-col gap-2.5">
      <CoverPreview
        src={src}
        accent={draft.url ? accentColor(draft.accent) : null}
        round={chosen?.kind === 'avatar'}
      >
        <p className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold text-ink-90">
          {t('chat.room.perks.cover.title')}
          {star !== 'star' && <StarMark size={14} lock />}
        </p>
        <p className="truncate text-[11px] text-ink-50">
          {chosen?.label ||
            (draft.url ? t('chat.room.perks.cover.custom') : t('chat.room.perks.cover.track'))}
        </p>
      </CoverPreview>

      <div className="-m-1 min-h-0 overflow-y-auto overscroll-contain p-1">
        <CoverChoices
          artwork={artwork}
          selected={draft.url}
          accent={draft.accent}
          onSelect={select}
          gridRef={grid}
        />
      </div>

      <AccentSwatches value={draft.accent} disabled={draft.url === null} onChange={pickAccent} />

      {error && (
        <CoverIssue
          key={error.attempt}
          error={error}
          wait={wait}
          star={star}
          onRetry={apply}
          onPickOther={pickOther}
        />
      )}

      <div className="flex min-h-8 items-center gap-2">
        {star === 'star' && current && (
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => void save(null)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold text-ink-55 transition-colors hover:bg-ink/[0.06] hover:text-ink-85 disabled:cursor-default disabled:opacity-50"
          >
            {saving === 'reset' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RotateCcw size={12} />
            )}
            {t('chat.room.perks.cover.reset')}
          </button>
        )}
        <span className="flex-1" />
        {star === 'star' ? (
          <button
            type="button"
            disabled={!changed || saving !== null || wait > 0}
            onClick={apply}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition-[transform,opacity] duration-200 hover:-translate-y-px active:scale-[0.97] disabled:cursor-default disabled:opacity-40 disabled:hover:translate-y-0"
            style={{ background: accentColor(draft.accent), color: accentInk(draft.accent) }}
          >
            {saving === 'set' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} strokeWidth={3} />
            )}
            {t('chat.room.perks.cover.apply')}
          </button>
        ) : (
          <StarAction state={star} />
        )}
      </div>
    </div>
  );
});
