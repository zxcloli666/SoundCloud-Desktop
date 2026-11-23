import { openUrl } from '@tauri-apps/plugin-opener';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, ExternalLink, Loader2 } from '../../../../lib/icons';
import { disconnectScrobbler } from '../../../../lib/scrobble/client';
import type { ScrobbleService, ScrobbleServiceStatus } from '../../../../stores/scrobble';
import { BRANDS, BrandMark } from './brands';

export function TileShell({
  service,
  tagline,
  connected,
  children,
}: {
  service: ScrobbleService;
  tagline: string;
  connected: boolean;
  children: ReactNode;
}) {
  const brand = BRANDS[service];
  return (
    <div
      className="relative flex flex-col gap-3.5 overflow-hidden rounded-[12px] border p-3.5 transition-[border-color] duration-300"
      style={{
        borderColor: connected ? brand.glow : 'var(--set-line)',
        background: `radial-gradient(120% 90% at 0% 0%, ${brand.wash}, transparent 55%), var(--set-well)`,
      }}
    >
      <div className="flex items-center gap-3">
        <BrandMark service={service} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink-90">{brand.name}</p>
          <p className="truncate text-[12px] text-ink-45">{tagline}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function TileButton({
  onClick,
  children,
  brand,
  disabled,
  submit = false,
}: {
  onClick?: () => void;
  children: ReactNode;
  brand?: ScrobbleService;
  disabled?: boolean;
  submit?: boolean;
}) {
  const color = brand ? BRANDS[brand] : null;
  return (
    <button
      type={submit ? 'submit' : 'button'}
      onClick={onClick}
      disabled={disabled}
      className="set-btn"
      data-tone={color ? 'brand' : undefined}
      style={color ? { background: color.mark } : undefined}
    >
      {children}
    </button>
  );
}

function Avatar({
  service,
  name,
  image,
}: {
  service: ScrobbleService;
  name: string;
  image: string | null;
}) {
  const brand = BRANDS[service];
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="relative size-11 shrink-0 rounded-full p-[2px]"
      style={{ background: brand.mark }}
    >
      {image && !broken ? (
        <img
          src={image}
          alt=""
          onError={() => setBroken(true)}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center rounded-full bg-surface text-[15px] font-bold text-ink-85">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

export function AccountView({
  service,
  status,
}: {
  service: ScrobbleService;
  status: ScrobbleServiceStatus;
}) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const profile = status.profile;
  if (!profile) return null;
  const count = profile.playcount;
  const since = profile.since ? new Date(profile.since * 1000).getFullYear() : null;

  const disconnect = () => {
    setBusy(true);
    void disconnectScrobbler(service).finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar service={service} name={profile.name} image={profile.image} />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-ink-85">{profile.name}</p>
          <p className="truncate text-[12px] text-ink-45 tabular-nums">
            {count != null
              ? t(BRANDS[service].countKey, {
                  count,
                  formatted: count.toLocaleString(i18n.language),
                })
              : t('settings.scrobbleConnected')}
            {since ? ` · ${t('settings.scrobbleSince', { year: since })}` : ''}
          </p>
        </div>
      </div>
      {status.pending > 0 && (
        <div className="flex items-center gap-2 rounded-[8px] bg-ink/[0.04] px-2.5 py-1.5 text-[12px] text-ink-55">
          <Clock size={12} className="shrink-0" />
          {t('settings.scrobblePending', { count: status.pending })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {profile.url && (
          <TileButton onClick={() => void openUrl(profile.url as string).catch(() => undefined)}>
            <ExternalLink size={13} />
            {t('settings.scrobbleOpenProfile')}
          </TileButton>
        )}
        <TileButton onClick={disconnect} disabled={busy}>
          {busy && <Loader2 size={13} className="animate-spin" />}
          {t('settings.scrobbleDisconnect')}
        </TileButton>
      </div>
    </div>
  );
}
