import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { Check, Copy, Power } from '../../lib/icons';
import { leaveSession, shareText } from '../../lib/together/session';
import type { RoomView } from '../../lib/together/types';
import { getArtistDisplay, getDisplayTitle } from '../../lib/track-display';
import { isRoomHost, useTogetherStore } from '../../stores/together';
import { MemberList } from './MemberList';
import { SyncBadge } from './SyncBadge';

const COPIED_MS = 1600;

function CodeCard({ code }: { code: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard
      .writeText(shareText(code))
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-accent/[0.14] via-white/[0.03] to-transparent p-3">
      <div className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-accent/20 blur-2xl" />
      <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {t('together.code')}
      </p>
      <div className="relative mt-1 flex items-center justify-between gap-2">
        <span className="select-all font-mono text-[26px] font-bold tracking-[0.28em] text-white">
          {code}
        </span>
        <button
          type="button"
          onClick={copy}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
            copied
              ? 'bg-[#23a55a]/20 text-[#3ddc84]'
              : 'bg-white/[0.08] text-white/70 hover:bg-white/[0.13] hover:text-white'
          }`}
        >
          {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
          {t(copied ? 'together.copied' : 'together.invite')}
        </button>
      </div>
    </div>
  );
}

function NowShared({ room, host }: { room: RoomView; host: boolean }) {
  const { t } = useTranslation();
  const track = room.playback.track;
  const hostName = room.members.find((m) => m.userId === room.hostId)?.name ?? '';
  const caption = host ? t('together.friendsHear') : t('together.hostPlays', { name: hostName });
  const cover = track ? art(track.artwork_url || track.user?.avatar_url, 't200x200') : null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.035] p-2">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
        {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        {room.playback.status === 'playing' && (
          <div className="absolute inset-0 flex items-end justify-center gap-[2px] bg-black/35 pb-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-[3px] origin-bottom rounded-full bg-white/90 animate-[npb-eq_0.9s_ease-in-out_infinite]"
                style={{ height: 12, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10.5px] text-white/40">{caption}</p>
        <p className="truncate text-[12.5px] font-semibold text-white/90">
          {track ? getDisplayTitle(track) : t('together.nothingYet')}
        </p>
        {track && (
          <p className="truncate text-[11px] text-white/45">
            {getArtistDisplay(track).primary || track.user?.username}
          </p>
        )}
      </div>
    </div>
  );
}

export function LiveView({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const host = useTogetherStore(isRoomHost);
  const selfId = useTogetherStore((s) => s.selfId);

  return (
    <div className="relative space-y-3">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70">
            {t('together.live')}
          </p>
        </div>
        <SyncBadge />
      </div>

      <CodeCard code={room.code} />
      <NowShared room={room} host={host} />

      <div>
        <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
          {t('together.listeners', { count: room.members.length })}
        </p>
        <MemberList room={room} selfId={selfId} />
      </div>

      <button
        type="button"
        onClick={() => void leaveSession()}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 text-[12.5px] font-semibold text-white/60 transition-all duration-200 hover:border-rose-400/30 hover:bg-rose-400/[0.08] hover:text-rose-200 active:scale-[0.98]"
      >
        <Power size={14} />
        {host ? t('together.end') : t('together.leave')}
      </button>
    </div>
  );
}
