import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomCover } from '../../../../lib/chat/media-types';
import { Check, ImageIcon, Loader2, RefreshCw, RotateCcw } from '../../../../lib/icons';
import { setRoomCover } from '../../../../lib/together/room-actions';
import type { RoomView } from '../../../../lib/together/types';
import { StarCta } from '../../../star-moments/StarCta';
import { AccentSwatches } from './AccentSwatches';
import { CoverGrid } from './CoverGrid';
import { type CoverError, CoverIssue } from './CoverIssue';
import { CoverPreview } from './CoverPreview';
import { PERK_KEYFRAMES } from './keyframes';
import { accentColor, accentInk, coverSrc, roomPerks, validCover } from './perks';
import { StarMark } from './StarMark';
import { type ArtworkChoices, useArtworkChoices } from './useArtworkChoices';

const SKELETON = Array.from({ length: 8 }, (_, index) => `tile-${index}`);

interface Draft {
  url: string | null;
  accent: number;
}

function GridState({
  artwork,
  draft,
  onSelect,
}: {
  artwork: ArtworkChoices;
  draft: Draft;
  onSelect: (url: string) => void;
}) {
  const { t } = useTranslation();
  if (artwork.loading) {
    return (
      <div aria-busy className="grid grid-cols-4 gap-2 p-1.5">
        {SKELETON.map((id) => (
          <span key={id} className="aspect-square animate-pulse rounded-[10px] bg-ink/[0.06]" />
        ))}
      </div>
    );
  }
  if (artwork.failed) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
        <p className="text-[12px] font-semibold text-ink-70">
          {t('chat.room.perks.cover.loadFailed')}
        </p>
        <button
          type="button"
          onClick={artwork.retry}
          className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.08] px-3 text-[11.5px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.14]"
        >
          <RefreshCw size={11} />
          {t('chat.room.perks.cover.retry')}
        </button>
      </div>
    );
  }
  if (artwork.choices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-[10px] border border-dashed border-ink/20 text-ink-35">
          <ImageIcon size={16} />
        </span>
        <p className="text-[12px] font-semibold text-ink-70">{t('chat.room.perks.cover.empty')}</p>
      </div>
    );
  }
  return (
    <CoverGrid
      choices={artwork.choices}
      selected={draft.url}
      accent={accentColor(draft.accent)}
      ink={accentInk(draft.accent)}
      onSelect={onSelect}
    />
  );
}

export const CoverPicker = memo(function CoverPicker({
  room,
  onSaved,
}: {
  room: RoomView;
  onSaved: (cover: RoomCover | null) => void;
}) {
  const { t } = useTranslation();
  const star = roomPerks(room).starHost;
  const current = validCover(room.cover);
  const artwork = useArtworkChoices(true);
  const [draft, setDraft] = useState<Draft>({
    url: current?.url ?? null,
    accent: current?.accent ?? 0,
  });
  const [saving, setSaving] = useState<'set' | 'reset' | null>(null);
  const [error, setError] = useState<CoverError | null>(null);

  const track = room.playback.track;
  const trackArt = track ? track.artwork_url || track.user?.avatar_url : null;
  const chosen = artwork.choices.find((choice) => choice.url === draft.url) ?? null;
  const src = draft.url ? coverSrc(draft.url) : coverSrc(trackArt);
  const changed =
    draft.url !== null && (draft.url !== current?.url || draft.accent !== current?.accent);

  const save = async (cover: RoomCover | null) => {
    setSaving(cover ? 'set' : 'reset');
    setError(null);
    const outcome = await setRoomCover(cover);
    setSaving(null);
    if (outcome.ok) onSaved(cover);
    else setError({ code: outcome.code, retryMs: outcome.retryMs });
  };

  const apply = () => {
    if (draft.url) void save({ url: draft.url, accent: draft.accent });
  };

  return (
    <div data-ui="room-cover-picker" className="flex flex-col gap-2.5">
      <style>{PERK_KEYFRAMES}</style>
      <CoverPreview
        src={src}
        accent={draft.url ? accentColor(draft.accent) : null}
        round={chosen?.kind === 'avatar'}
      >
        <p className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold text-ink-90">
          {t('chat.room.perks.cover.title')}
          {!star && <StarMark size={14} />}
        </p>
        <p className="truncate text-[11px] text-ink-50">
          {chosen?.label ||
            (draft.url ? t('chat.room.perks.cover.custom') : t('chat.room.perks.cover.track'))}
        </p>
      </CoverPreview>

      <GridState
        artwork={artwork}
        draft={draft}
        onSelect={(url) => {
          setError(null);
          setDraft((prev) => ({ ...prev, url }));
        }}
      />

      <AccentSwatches
        value={draft.accent}
        onChange={(accent) => setDraft((prev) => ({ ...prev, accent }))}
      />

      {error && (
        <CoverIssue
          key={`${error.code}-${error.retryMs}`}
          error={error}
          onRetry={apply}
          onPickOther={() => {
            setError(null);
            setDraft((prev) => ({ ...prev, url: null }));
          }}
        />
      )}

      <div className="flex items-center gap-2">
        {star && current && (
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
        {star ? (
          <button
            type="button"
            disabled={!changed || saving !== null}
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
          <StarCta size="sm" />
        )}
      </div>
    </div>
  );
});
