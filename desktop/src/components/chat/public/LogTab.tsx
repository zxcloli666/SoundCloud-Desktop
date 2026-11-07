import type { TFunction } from 'i18next';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { Timer } from '../../../lib/chat/icons';
import { shortDate } from '../../../lib/chat/time';
import type { PublicLogEntry } from '../../../lib/chat/types';
import { Ban, RotateCcw, Trash2 } from '../../../lib/icons';
import { Skeleton } from '../../ui/Skeleton';
import { MicOff, ShieldMinus, ShieldPlus } from '../room/icons';
import { useThread } from '../thread/context';
import { durationLabel, unbanUser, unmuteUser } from './actions';
import { Mic, ScrollText, UserCheck } from './icons';

const PAGE = 40;

type Load = 'loading' | 'ready' | 'failed';

const ICONS = {
  mute: MicOff,
  unmute: Mic,
  ban: Ban,
  unban: UserCheck,
  slow_mode: Timer,
  delete: Trash2,
  moderator_add: ShieldPlus,
  moderator_remove: ShieldMinus,
} as const;

const TONES: Record<keyof typeof ICONS, string> = {
  mute: 'bg-rose-500/12 text-rose-300',
  unmute: 'bg-ok/10 text-ok',
  ban: 'bg-rose-500/18 text-rose-200',
  unban: 'bg-ok/10 text-ok',
  slow_mode: 'bg-ink/[0.06] text-ink-60',
  delete: 'bg-ink/[0.06] text-ink-60',
  moderator_add: 'bg-sky-400/12 text-sky-300',
  moderator_remove: 'bg-ink/[0.06] text-ink-60',
};

function isKnown(action: string): action is keyof typeof ICONS {
  return action in ICONS;
}

function lineOf(entry: PublicLogEntry, t: TFunction): string {
  const by = entry.by.name;
  const user = entry.user?.name ?? '';
  switch (entry.action) {
    case 'mute':
      return t('chat.public.log.mute', {
        by,
        user,
        duration: durationLabel(entry.seconds ?? 0),
      });
    case 'slow_mode':
      return entry.seconds
        ? t('chat.public.log.slow_mode', { by, value: durationLabel(entry.seconds) })
        : t('chat.public.log.slowOff', { by });
    case 'unmute':
    case 'ban':
    case 'unban':
    case 'delete':
    case 'moderator_add':
    case 'moderator_remove':
      return t(`chat.public.log.${entry.action}`, { by, user });
    default:
      return t('chat.public.log.other', { by, action: entry.action });
  }
}

function liftedLater(entries: PublicLogEntry[], entry: PublicLogEntry): boolean {
  const lifts = entry.action === 'ban' ? 'unban' : 'unmute';
  const index = entries.indexOf(entry);
  return entries
    .slice(0, index)
    .some((later) => later.action === lifts && later.user?.id === entry.user?.id);
}

function Lift({
  entry,
  lifted,
  onDone,
}: {
  entry: PublicLogEntry;
  lifted: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { conversation } = useThread();
  const user = entry.user;
  if (!user || conversation.role !== 'owner' || lifted) return null;
  const ban = entry.action === 'ban';
  const mute = entry.action === 'mute' && entry.until !== null && entry.until > Date.now();
  if (!ban && !mute) return null;
  const lift = async () => {
    if (await (ban ? unbanUser(user) : unmuteUser(user))) onDone();
  };
  return (
    <button
      type="button"
      onClick={() => void lift()}
      className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-ok/10 px-2.5 text-[11.5px] font-semibold text-ok transition-colors duration-150 hover:bg-ok/20"
    >
      {ban ? <UserCheck size={12} /> : <Mic size={12} />}
      {t(ban ? 'chat.public.menu.unban' : 'chat.public.menu.unmute')}
    </button>
  );
}

const LogRow = memo(function LogRow({
  entry,
  entries,
  onLift,
}: {
  entry: PublicLogEntry;
  entries: PublicLogEntry[];
  onLift: () => void;
}) {
  const { t, i18n } = useTranslation();
  const known = isKnown(entry.action) ? entry.action : null;
  const Icon = known ? ICONS[known] : ScrollText;
  const tone = known ? TONES[known] : 'bg-ink/[0.06] text-ink-60';
  return (
    <div className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-ink/[0.03]">
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${tone}`}
      >
        <Icon size={13} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] leading-snug text-ink-85">{lineOf(entry, t)}</span>
        {entry.reason && (
          <span className="mt-0.5 block truncate text-[11.5px] italic text-ink-45">
            {entry.reason}
          </span>
        )}
        <span className="mt-0.5 block text-[10.5px] tabular-nums text-ink-30">
          {shortDate(entry.ts, Date.now(), i18n.language)}
        </span>
      </span>
      <Lift entry={entry} lifted={liftedLater(entries, entry)} onDone={onLift} />
    </div>
  );
});

function LogSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-2 pt-1">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-2.5 py-2">
          <Skeleton rounded="lg" className="size-7 shrink-0" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const LogTab = memo(function LogTab() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<PublicLogEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>('loading');

  const fetch = useCallback(async (before: string | null) => {
    setLoad('loading');
    try {
      const page = await chatBridge.publicLog(before, PAGE);
      setEntries((list) => (before ? [...list, ...page.entries] : page.entries));
      setNext(page.next);
      setLoad('ready');
    } catch {
      setLoad('failed');
    }
  }, []);

  useEffect(() => {
    void fetch(null);
  }, [fetch]);

  if (load === 'failed' && entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <span className="text-[12.5px] text-ink-45">{t('chat.public.log.failed')}</span>
        <button
          type="button"
          onClick={() => void fetch(null)}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.07] px-3.5 text-[12px] font-semibold text-ink-75 transition-colors hover:bg-ink/[0.12]"
        >
          <RotateCcw size={12} />
          {t('chat.thread.retry')}
        </button>
      </div>
    );
  }
  if (load === 'loading' && entries.length === 0) return <LogSkeleton />;
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <span className="flex size-11 items-center justify-center rounded-2xl border border-ink/[0.07] bg-ink/[0.04] text-ink-40">
          <ScrollText size={18} />
        </span>
        <span className="text-[12.5px] text-ink-45">{t('chat.public.log.empty')}</span>
      </div>
    );
  }

  return (
    <div data-ui="chat-public-log" className="flex flex-col gap-0.5">
      {entries.map((entry) => (
        <LogRow key={entry.id} entry={entry} entries={entries} onLift={() => void fetch(null)} />
      ))}
      {next && (
        <button
          type="button"
          disabled={load === 'loading'}
          onClick={() => void fetch(next)}
          className="mt-1 h-9 cursor-pointer rounded-xl bg-ink/[0.05] text-[12.5px] font-semibold text-ink-70 transition-colors hover:bg-ink/[0.09] disabled:opacity-50"
        >
          {t('chat.public.log.more')}
        </button>
      )}
    </div>
  );
});
