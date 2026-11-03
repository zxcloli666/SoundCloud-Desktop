import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiscordLink } from '../../lib/pay-client';

/* Discord brand mark, drawn in neutral/accent ink (not blurple) to stay inside the
 * pass's color language — only the booster/role chips carry the accent. */
const DiscordMark = memo(function DiscordMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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
      className="inline-flex items-center rounded-full px-[10px] py-[3px] font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-90"
      style={{
        border: '1px solid color-mix(in srgb, var(--color-accent) 42%, transparent)',
        background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
      }}
    >
      {label}
    </span>
  );
});

const Shell = memo(function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-[14px] border border-ink/[0.06] px-[18px] py-4"
      style={{ background: 'rgb(var(--ink) / 0.03)' }}
    >
      <div className="mb-3 flex items-center gap-[7px] text-ink-45">
        <DiscordMark size={15} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em]">
          {t('starpass.discord.label')}
        </span>
      </div>
      {children}
    </div>
  );
});

/** The user's linked Discord on the STAR manage view: identity + booster / STAR-role
 * state (bot-owned, mirrored by pay). Empty state nudges to `/sc-link`. */
export const DiscordCard = memo(function DiscordCard({ discord }: { discord: DiscordLink | null }) {
  const { t } = useTranslation();

  if (!discord) {
    return (
      <Shell>
        <div className="text-[13px] text-ink-75">{t('starpass.discord.unlinked')}</div>
        <div className="mt-[6px] flex items-center gap-2 text-[12px] text-ink-40">
          <span>{t('starpass.discord.linkHint')}</span>
        </div>
        <code
          className="selectable mt-3 inline-block rounded-md px-2 py-1 font-mono text-[12px] text-ink-85"
          style={{ background: 'rgb(var(--ink) / 0.06)' }}
        >
          /sc-link
        </code>
      </Shell>
    );
  }

  const name = discord.global_name || discord.username || t('starpass.discord.member');
  return (
    <Shell>
      <div className="flex items-center gap-[13px]">
        <div
          className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full"
          style={{ background: 'rgb(var(--ink) / 0.07)' }}
        >
          <span className="font-mono text-[14px] text-ink-70">{initials(name)}</span>
          {discord.avatar_url && (
            // Discord CDN url — render direct, NOT via art() (that mangles non-SC urls).
            // If it fails to load, the initials behind it remain visible.
            <img
              src={discord.avatar_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium text-ink-95">{name}</div>
          {discord.username && (
            <div className="truncate font-mono text-[12px] text-ink-40">@{discord.username}</div>
          )}
        </div>
      </div>
      {(discord.is_booster || discord.has_star_role) && (
        <div className="mt-[14px] flex flex-wrap gap-2">
          {discord.is_booster && <Chip label={t('starpass.discord.booster')} />}
          {discord.has_star_role && <Chip label={t('starpass.discord.starRole')} />}
        </div>
      )}
    </Shell>
  );
});
