import { useTranslation } from 'react-i18next';
import { Loader2 } from '../../../../lib/icons';
import {
  cancelLastfmAuth,
  resumeLastfmAuthCheck,
  startLastfmAuth,
} from '../../../../lib/scrobble/client';
import {
  type LastfmAuthFailure,
  type ScrobbleServiceStatus,
  useScrobbleStore,
} from '../../../../stores/scrobble';
import { CopyField } from '../obs/CopyField';
import { AccountView, TileButton, TileShell } from './ServiceTile';

const AUTH_ERRORS: Record<LastfmAuthFailure, string> = {
  network: 'settings.scrobbleAuthNetwork',
  refused: 'settings.scrobbleAuthRefused',
  failed: 'settings.scrobbleAuthError',
};

function Connecting() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 text-[12.5px] text-ink-60">
        <Loader2 size={14} className="shrink-0 animate-spin text-[#ff3b30]" />
        {t('settings.scrobbleConnecting')}
      </div>
      <div>
        <TileButton onClick={() => void cancelLastfmAuth()}>
          {t('settings.scrobbleCancel')}
        </TileButton>
      </div>
    </div>
  );
}

function ManualLink({ url }: { url: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-snug text-ink-40">{t('settings.scrobbleOpenFailed')}</p>
      <CopyField value={url} />
      <div>
        <TileButton onClick={() => void cancelLastfmAuth()}>
          {t('settings.scrobbleCancel')}
        </TileButton>
      </div>
    </div>
  );
}

function Waiting() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 text-[12.5px] text-ink-60">
        <Loader2 size={14} className="shrink-0 animate-spin text-[#ff3b30]" />
        {t('settings.scrobbleWaiting')}
      </div>
      <div className="flex flex-wrap gap-2">
        <TileButton brand="lastfm" onClick={resumeLastfmAuthCheck}>
          {t('settings.scrobbleCheckNow')}
        </TileButton>
        <TileButton onClick={() => void cancelLastfmAuth()}>
          {t('settings.scrobbleCancel')}
        </TileButton>
      </div>
    </div>
  );
}

export function LastfmTile({ status }: { status: ScrobbleServiceStatus }) {
  const { t } = useTranslation();
  const auth = useScrobbleStore((s) => s.lastfmAuth);
  const connected = Boolean(status.profile);

  const body = () => {
    if (connected) return <AccountView service="lastfm" status={status} />;
    if (!status.available) {
      return <p className="text-[12px] text-ink-35">{t('settings.scrobbleUnavailable')}</p>;
    }
    if (auth.phase === 'connecting') return <Connecting />;
    if (auth.phase === 'waiting') return <Waiting />;
    if (auth.phase === 'manual') return <ManualLink url={auth.url} />;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[12px] leading-snug text-ink-40">
          {t(auth.phase === 'error' ? AUTH_ERRORS[auth.failure] : 'settings.scrobbleLastfmHint')}
        </p>
        <div>
          <TileButton brand="lastfm" onClick={() => void startLastfmAuth()}>
            {t('settings.scrobbleConnect')}
          </TileButton>
        </div>
      </div>
    );
  };

  return (
    <TileShell service="lastfm" tagline={t('settings.scrobbleLastfmTagline')} connected={connected}>
      {body()}
    </TileShell>
  );
}
