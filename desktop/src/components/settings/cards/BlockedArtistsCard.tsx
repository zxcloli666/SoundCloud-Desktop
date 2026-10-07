import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type BlockedArtist, useBlocklistVersion } from '../../../lib/blocked-artists';
import { Ban, Loader2, MicVocal, User } from '../../../lib/icons';
import { userUrn } from '../../../lib/ids';
import { useBlockToggle } from '../../music/blocklist/useBlockToggle';
import { Avatar } from '../../ui/Avatar';
import { Card } from '../primitives';

function entryPath(entry: BlockedArtist): string | null {
  if (entry.kind === 'artist') return `/artist/${encodeURIComponent(entry.id)}`;
  const urn = userUrn(entry.id);
  return urn ? `/user/${encodeURIComponent(urn)}` : null;
}

function blockedSince(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const BlockedRow = memo(({ entry }: { entry: BlockedArtist }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { busy, unblock } = useBlockToggle(entry);
  const path = entryPath(entry);
  const since = blockedSince(entry.created_at);

  return (
    <li className="group flex items-center gap-3 rounded-2xl border-[0.5px] border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition-colors duration-200 hover:border-white/[0.10] hover:bg-white/[0.04]">
      <button
        type="button"
        disabled={!path}
        onClick={() => path && navigate(path)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer disabled:cursor-default"
      >
        <span className="relative shrink-0">
          <Avatar
            src={entry.avatar_url}
            alt={entry.name}
            size={38}
            className="grayscale-[0.6] opacity-80"
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#101012] bg-rose-500 text-white">
            <Ban size={10} strokeWidth={3} />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-semibold text-white/80 group-hover:text-white">
            {entry.name}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/30">
            {entry.kind === 'artist' ? <MicVocal size={11} /> : <User size={11} />}
            {entry.kind === 'artist' ? t('blocklist.kindArtist') : t('blocklist.kindUser')}
            {since && (
              <span className="text-white/20">· {t('blocklist.since', { date: since })}</span>
            )}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => void unblock(entry)}
        disabled={busy}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border-[0.5px] border-white/[0.08] bg-white/[0.04] px-3.5 text-[11.5px] font-semibold text-white/55 transition-all duration-200 cursor-pointer hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white active:scale-95 disabled:opacity-60"
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        {t('blocklist.unblock')}
      </button>
    </li>
  );
});

export function BlockedArtistsCard() {
  const { t } = useTranslation();
  const entries = useBlocklistVersion();

  return (
    <Card
      title={t('blocklist.cardTitle')}
      desc={t('blocklist.cardDesc')}
      icon={<Ban size={17} />}
      action={
        entries.length > 0 ? (
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border-[0.5px] border-rose-400/25 bg-rose-500/10 px-2.5 text-[12px] font-bold tabular-nums text-rose-300">
            {entries.length}
          </span>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/[0.08] px-4 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-white/25">
            <Ban size={16} />
          </span>
          <p className="text-[12px] leading-snug text-white/35">{t('blocklist.empty')}</p>
        </div>
      ) : (
        <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <BlockedRow key={`${entry.kind}:${entry.id}`} entry={entry} />
          ))}
        </ul>
      )}
    </Card>
  );
}
