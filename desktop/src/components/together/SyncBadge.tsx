import { useTranslation } from 'react-i18next';
import { Check, Loader2, WifiOff } from '../../lib/icons';
import { isRoomHost, useTogetherStore } from '../../stores/together';

type Tone = 'good' | 'busy' | 'warn';

const TONES: Record<Tone, string> = {
  good: 'border-[#3ddc84]/20 bg-[#3ddc84]/[0.07] text-[#3ddc84]/90',
  busy: 'border-accent/25 bg-accent/[0.08] text-accent',
  warn: 'border-amber-300/20 bg-amber-300/[0.07] text-amber-200/90',
};

function useBadge(): { tone: Tone; label: string } | null {
  const { t } = useTranslation();
  const phase = useTogetherStore((s) => s.phase);
  const sync = useTogetherStore((s) => s.sync);
  const waitingFor = useTogetherStore((s) => s.waitingFor);
  const room = useTogetherStore((s) => s.room);
  const host = useTogetherStore(isRoomHost);
  if (!room) return null;
  if (phase === 'reconnecting') return { tone: 'warn', label: t('together.sync.reconnecting') };
  if (host) {
    if (waitingFor > 0) {
      return { tone: 'busy', label: t('together.sync.waiting', { count: waitingFor }) };
    }
    const listeners = room.online.filter((id) => id !== room.hostId).length;
    return listeners > 0
      ? { tone: 'good', label: t('together.sync.hosting', { count: listeners }) }
      : { tone: 'busy', label: t('together.sync.alone') };
  }
  if (!room.online.includes(room.hostId))
    return { tone: 'warn', label: t('together.sync.hostAway') };
  if (room.playback.status === 'loading' || sync !== 'synced') {
    return { tone: 'busy', label: t('together.sync.catchingUp') };
  }
  return { tone: 'good', label: t('together.sync.synced') };
}

export function SyncBadge() {
  const badge = useBadge();
  if (!badge) return null;
  const icon =
    badge.tone === 'good' ? (
      <Check size={12} strokeWidth={3} />
    ) : badge.tone === 'busy' ? (
      <Loader2 size={12} className="animate-spin" />
    ) : (
      <WifiOff size={12} />
    );
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors duration-300 ${TONES[badge.tone]}`}
    >
      {icon}
      <span className="truncate">{badge.label}</span>
    </div>
  );
}
