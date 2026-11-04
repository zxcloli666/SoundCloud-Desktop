import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { receivedEmbed } from '../../../lib/chat/embed-snapshot';
import { ink } from '../../../lib/chat/tone';
import type { Embed, RoomInvite } from '../../../lib/chat/types';
import { art } from '../../../lib/formatters';
import { ArrowRight, Headphones, Loader2, Lock, Users } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { sessionErrorKey } from '../../../lib/together/errors';
import { joinSession } from '../../../lib/together/session';
import { useTogetherStore } from '../../../stores/together';
import { BackdropThumb, hasBackdropThumb } from '../room/BackdropThumb';
import { ArtImage } from '../room/perks/ArtImage';
import { accentRgb, roomArt } from '../room/perks/perks';
import { StarMark } from '../room/perks/StarMark';
import { EmbedShell } from './EmbedShell';
import { useInView } from './useInView';
import { useRoomPreview } from './useRoomPreview';

interface RoomInviteEmbedProps {
  embed: Embed;
  mine: boolean;
  compact: boolean;
}

function LiveDot() {
  const perf = usePerfMode();
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {perf.idleAnim && (
        <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
      )}
      <span className="relative h-2 w-2 rounded-full bg-accent" />
    </span>
  );
}

function Perforation({ edge }: { edge: number }) {
  return (
    <span aria-hidden className="relative mx-3 w-px self-stretch">
      <span
        className="absolute inset-y-1 left-0 w-px"
        style={{
          backgroundImage: `linear-gradient(to bottom, ${ink(22)} 50%, transparent 50%)`,
          backgroundSize: '1px 6px',
        }}
      />
      <span
        className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-shade-40"
        style={{ top: -edge }}
      />
      <span
        className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-shade-40"
        style={{ bottom: -edge }}
      />
    </span>
  );
}

const SOLID_FULL = {
  background: 'color-mix(in srgb, var(--color-amber-300) 12%, rgb(var(--paper)))',
};
const SOLID_HERE = { background: 'color-mix(in srgb, var(--color-accent) 15%, rgb(var(--paper)))' };

function JoinButton({
  code,
  here,
  full,
  overArt,
}: {
  code: string;
  here: boolean;
  full: boolean;
  overArt: boolean;
}) {
  const { t } = useTranslation();
  const [joining, setJoining] = useState(false);
  if (full && !here) {
    return (
      <span
        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-amber-200 ${
          overArt ? '' : 'bg-amber-300/[0.12]'
        }`}
        style={overArt ? SOLID_FULL : undefined}
      >
        <Users size={12} />
        {t('chat.embeds.room.full')}
      </span>
    );
  }
  if (here) {
    return (
      <span
        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${
          overArt ? 'text-ink-90' : 'bg-accent/15 text-accent'
        }`}
        style={overArt ? SOLID_HERE : undefined}
      >
        <Headphones size={13} className={overArt ? 'text-accent' : undefined} />
        {t('chat.embeds.room.here')}
      </span>
    );
  }
  const join = async () => {
    setJoining(true);
    try {
      await joinSession(code);
    } catch (error) {
      toast.error(t(sessionErrorKey(error)));
    } finally {
      setJoining(false);
    }
  };
  return (
    <button
      type="button"
      disabled={joining}
      onClick={() => void join()}
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[12px] font-semibold text-accent-contrast transition-transform duration-300 cursor-pointer hover:scale-[1.03] active:scale-[0.97] disabled:cursor-default"
      style={{ boxShadow: '0 6px 18px var(--color-accent-glow)' }}
    >
      {joining ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
      {t('chat.embeds.room.join')}
    </button>
  );
}

function roomTitle(room: RoomInvite, title: string | null | undefined, fallback: string): string {
  return title || room.title || fallback;
}

export const RoomInviteEmbed = memo(function RoomInviteEmbed({
  embed,
  mine,
  compact,
}: RoomInviteEmbedProps) {
  const { t } = useTranslation();
  const [ref, visible] = useInView<HTMLDivElement>();
  const room = embed.room;
  const code = room?.code ?? '';
  const { preview, closed } = useRoomPreview(code, visible && !compact);
  const here = useTogetherStore((s) => !!code && s.room?.code === code);
  if (!room) return null;

  const live = !closed && (preview?.alive ?? true);
  const title = roomTitle(room, preview?.title, t('chat.embeds.room.untitled'));
  const host = preview?.host.name || room.host;
  const track = preview?.track ? receivedEmbed(preview.track) : null;
  const cover = art(track?.artworkUrl, 't200x200');
  const roomCover = roomArt(preview?.starHost ? preview.cover : null, null);
  const capacity = preview?.capacity ?? 0;
  const full = !!preview && capacity > 0 && preview.listeners >= capacity;
  const overArt = live && hasBackdropThumb(preview?.backdrop);
  const soft = overArt ? 'text-ink-70' : 'text-ink-45';

  return (
    <EmbedShell
      kind={embed.kind}
      ref={ref}
      mine={mine}
      dim={!live}
      compact={compact}
      label={title}
      tint={roomCover.accent ? accentRgb(roomCover.accent) : null}
    >
      {live && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          <BackdropThumb backdrop={preview?.backdrop ?? null} />
        </div>
      )}
      <div className="relative flex min-w-0 items-stretch" style={{ isolation: 'isolate' }}>
        <div className="flex shrink-0 flex-col justify-between gap-2 py-0.5">
          <span
            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
              overArt ? 'text-ink-70' : 'text-ink-55'
            }`}
          >
            {live ? <LiveDot /> : <Lock size={11} />}
            {live && t('chat.embeds.room.live')}
          </span>
          <span className="font-mono text-[15px] font-bold tracking-[0.18em] text-ink-90">
            {room.code}
          </span>
          {!compact && preview && live && (
            <span
              className={`flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
                full && !overArt ? 'text-amber-200' : soft
              }`}
            >
              <Headphones size={11} />
              {capacity > 0 ? `${preview.listeners}/${capacity}` : preview.listeners}
            </span>
          )}
        </div>
        <Perforation edge={compact ? 13 : 17} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            {roomCover.src && live && (
              <ArtImage
                src={roomCover.src}
                seed={roomCover.src}
                className="size-9 shrink-0 rounded-[9px] object-cover"
                style={{
                  boxShadow: `0 0 0 1.5px ${roomCover.accent}, 0 6px 16px -8px ${roomCover.accent}`,
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold leading-tight text-ink-92">
                {title}
              </p>
              {host && (
                <p className={`flex min-w-0 items-center gap-1 text-[11.5px] ${soft}`}>
                  <span className="truncate">{t('chat.embeds.room.host', { name: host })}</span>
                  {preview?.starHost && <StarMark size={13} />}
                </p>
              )}
            </div>
          </div>
          {!compact && track && live && (
            <div className="flex min-w-0 items-center gap-2">
              {cover && (
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-7 w-7 shrink-0 rounded-[7px] object-cover"
                />
              )}
              <span
                className={`min-w-0 truncate text-[11.5px] ${overArt ? 'text-ink-85' : 'text-ink-65'}`}
              >
                {track.title}
                {track.artist && (
                  <span className={overArt ? 'text-ink-70' : 'text-ink-35'}> · {track.artist}</span>
                )}
              </span>
            </div>
          )}
          {!compact && (
            <div className="flex justify-end">
              {live ? (
                <JoinButton code={room.code} here={here} full={full} overArt={overArt} />
              ) : (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink/[0.06] px-3 text-[12px] font-semibold text-ink-60">
                  <Lock size={12} />
                  {t('chat.embeds.room.closed')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </EmbedShell>
  );
});
