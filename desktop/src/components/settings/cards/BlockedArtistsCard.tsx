import { useVirtualizer } from '@tanstack/react-virtual';
import { type CSSProperties, memo, useRef } from 'react';
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

const ROW_PITCH = 64;

const BlockedRow = memo(({ entry, style }: { entry: BlockedArtist; style: CSSProperties }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { busy, unblock } = useBlockToggle(entry);
  const path = entryPath(entry);
  const since = blockedSince(entry.created_at);

  return (
    <li
      style={style}
      className="group absolute top-0 left-0 flex h-[58px] w-full items-center gap-3 rounded-[12px] bg-[var(--set-well)] px-3 py-2.5 transition-colors duration-150 hover:bg-[var(--set-well-hi)]"
    >
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
          <span className="absolute -right-0.5 -bottom-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-[rgb(var(--surface))] bg-bad text-[rgb(var(--paper))]">
            <Ban size={10} strokeWidth={3} />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-ink-90">{entry.name}</span>
          <span className="flex items-center gap-1.5 text-[11.5px] text-ink-40">
            {entry.kind === 'artist' ? <MicVocal size={11} /> : <User size={11} />}
            {entry.kind === 'artist' ? t('blocklist.kindArtist') : t('blocklist.kindUser')}
            {since && (
              <span className="text-ink-30">· {t('blocklist.since', { date: since })}</span>
            )}
          </span>
        </span>
      </button>
      <button type="button" onClick={() => void unblock(entry)} disabled={busy} className="set-btn">
        {busy && <Loader2 size={12} className="animate-spin" />}
        {t('blocklist.unblock')}
      </button>
    </li>
  );
});

export function BlockedArtistsCard() {
  const { t } = useTranslation();
  const entries = useBlocklistVersion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_PITCH,
    overscan: 8,
    getItemKey: (index) => `${entries[index].kind}:${entries[index].id}`,
  });

  return (
    <Card
      title={t('blocklist.cardTitle')}
      desc={t('blocklist.cardDesc')}
      icon={<Ban size={17} />}
      action={
        entries.length > 0 ? (
          <span className="set-chip h-7 min-w-7 justify-center px-2.5">{entries.length}</span>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <p className="text-[12.5px] leading-snug text-ink-40">{t('blocklist.empty')}</p>
      ) : (
        <div ref={scrollRef} className="max-h-[420px] overflow-y-auto">
          <ul className="relative w-full" style={{ height: virtualizer.getTotalSize() - 6 }}>
            {virtualizer.getVirtualItems().map((row) => (
              <BlockedRow
                key={row.key}
                entry={entries[row.index]}
                style={{ transform: `translateY(${row.start}px)` }}
              />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
