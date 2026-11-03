import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { receivedEmbed } from '../../../lib/chat/embed-snapshot';
import { ink } from '../../../lib/chat/tone';
import type { Embed, RoomInvite } from '../../../lib/chat/types';
import { art } from '../../../lib/formatters';
import { ArrowRight, Headphones, Loader2, Lock } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { sessionErrorKey } from '../../../lib/together/errors';
import { joinSession } from '../../../lib/together/session';
import { useTogetherStore } from '../../../stores/together';
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
        className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-black/40"
        style={{ top: -edge }}
      />
      <span
        className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-black/40"
        style={{ bottom: -edge }}
      />
    </span>
  );
}

function JoinButton({ code, here }: { code: string; here: boolean }) {
  const { t } = useTranslation();
  const [joining, setJoining] = useState(false);
  if (here) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent/15 px-3 text-[12px] font-semibold text-accent">
        <Headphones size={13} />
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

  return (
    <EmbedShell kind={embed.kind} ref={ref} mine={mine} dim={!live} compact={compact} label={title}>
      <div className="flex min-w-0 items-stretch">
        <div className="flex shrink-0 flex-col justify-between gap-2 py-0.5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-55">
            {live ? <LiveDot /> : <Lock size={11} />}
            {live && t('chat.embeds.room.live')}
          </span>
          <span className="font-mono text-[15px] font-bold tracking-[0.18em] text-ink-90">
            {room.code}
          </span>
          {!compact && preview && live && (
            <span className="flex items-center gap-1 text-[11px] tabular-nums text-ink-45">
              <Headphones size={11} />
              {preview.listeners}
            </span>
          )}
        </div>
        <Perforation edge={compact ? 13 : 17} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold leading-tight text-ink-92">
              {title}
            </p>
            {host && (
              <p className="truncate text-[11.5px] text-ink-45">
                {t('chat.embeds.room.host', { name: host })}
              </p>
            )}
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
              <span className="min-w-0 truncate text-[11.5px] text-ink-65">
                {track.title}
                {track.artist && <span className="text-ink-35"> · {track.artist}</span>}
              </span>
            </div>
          )}
          {!compact && (
            <div className="flex justify-end">
              {live ? (
                <JoinButton code={room.code} here={here} />
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
