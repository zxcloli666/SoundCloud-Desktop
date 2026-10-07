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
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl p-4 transition-[border-color,box-shadow] duration-500"
      style={{
        border: `0.5px solid ${connected ? brand.glow : 'rgba(255,255,255,0.06)'}`,
        background: `radial-gradient(120% 90% at 0% 0%, ${brand.wash}, transparent 60%), rgba(255,255,255,0.02)`,
        boxShadow: connected ? `0 10px 32px ${brand.wash}` : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <BrandMark service={service} />
        <div className="min-w-0">
          <p className="text-[14px] font-bold tracking-tight text-white/90">{brand.name}</p>
          <p className="truncate text-[11.5px] text-white/35">{tagline}</p>
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
        color
          ? 'text-white hover:brightness-110'
          : 'border border-white/[0.06] bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white/80'
      }`}
      style={color ? { background: color.mark, boxShadow: `0 6px 18px ${color.glow}` } : undefined}
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
      style={{ background: brand.mark, boxShadow: `0 0 18px ${brand.glow}` }}
    >
      {image && !broken ? (
        <img
          src={image}
          alt=""
          onError={() => setBroken(true)}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center rounded-full bg-[#121216] text-[15px] font-bold text-white/85">
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
          <p className="truncate text-[13.5px] font-semibold text-white/85">{profile.name}</p>
          <p className="truncate text-[11.5px] text-white/40 tabular-nums">
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
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] text-white/50">
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
