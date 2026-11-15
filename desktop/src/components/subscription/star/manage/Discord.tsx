import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePaySubscription } from '../../../../lib/star-offer';
import { Panel } from '../ui/Panel';

const DiscordMark = memo(function DiscordMark() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.3 5.4A17 17 0 0 0 15 4l-.2.4a13 13 0 0 1 3.9 1.9 12 12 0 0 0-10.4 0A13 13 0 0 1 12.2 4.4L12 4a17 17 0 0 0-4.3 1.4C4.5 10 3.6 14.4 4 18.8A17 17 0 0 0 9.3 21l.9-1.5a11 11 0 0 1-1.8-.9l.4-.3a12 12 0 0 0 10.4 0l.4.3c-.6.4-1.2.7-1.8.9l.9 1.5A17 17 0 0 0 24 18.8c.4-5-1-9.4-4.7-13.4ZM9.5 16c-.9 0-1.6-.8-1.6-1.8s.7-1.9 1.6-1.9 1.6.9 1.6 1.9-.7 1.8-1.6 1.8Zm5 0c-.9 0-1.6-.8-1.6-1.8s.7-1.9 1.6-1.9 1.6.9 1.6 1.9-.7 1.8-1.6 1.8Z" />
    </svg>
  );
});

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

const Chip = memo(function Chip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-semibold text-ink-90"
      style={{
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 42%, transparent)',
        background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
      }}
    >
      {label}
    </span>
  );
});

export const Discord = memo(function Discord() {
  const { t } = useTranslation();
  const discord = usePaySubscription().data?.discord ?? null;
  const name = discord
    ? discord.global_name || discord.username || t('starpass.discord.member')
    : '';
  return (
    <Panel ui="star-discord" className="flex items-center gap-3.5">
      <span
        className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full text-ink-60"
        style={{ background: 'rgb(var(--ink) / 0.07)' }}
      >
        {discord ? (
          <>
            <span className="text-[14px] font-bold">{initials(name)}</span>
            {discord.avatar_url && (
              <img
                src={discord.avatar_url}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
            )}
          </>
        ) : (
          <DiscordMark />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-45">
          {discord && <DiscordMark />}
          {t('starpass.discord.label')}
        </div>
        {discord ? (
          <>
            <div className="truncate text-[14.5px] font-bold text-ink">{name}</div>
            {discord.username && (
              <div className="truncate text-[12px] text-ink-45">@{discord.username}</div>
            )}
          </>
        ) : (
          <>
            <div className="text-[14px] font-bold text-ink-85">
              {t('starpass.discord.unlinked')}
            </div>
            <div className="text-[12px] text-ink-45">{t('starpass.discord.linkHint')}</div>
          </>
        )}
      </div>
      {discord ? (
        (discord.is_booster || discord.has_star_role) && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {discord.is_booster && <Chip label={t('starpass.discord.booster')} />}
            {discord.has_star_role && <Chip label={t('starpass.discord.starRole')} />}
          </div>
        )
      ) : (
        <code
          className="selectable shrink-0 rounded-[8px] px-2 py-1 font-mono text-[12px] text-ink-85"
          style={{ background: 'rgb(var(--ink) / 0.06)' }}
        >
          /sc-link
        </code>
      )}
    </Panel>
  );
});
