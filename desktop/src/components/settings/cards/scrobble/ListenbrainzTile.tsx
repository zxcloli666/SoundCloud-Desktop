import { openUrl } from '@tauri-apps/plugin-opener';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Loader2 } from '../../../../lib/icons';
import { connectListenbrainz } from '../../../../lib/scrobble/client';
import type { ScrobbleServiceStatus } from '../../../../stores/scrobble';
import { AccountView, TileButton, TileShell } from './ServiceTile';

const TOKEN_PAGE = 'https://listenbrainz.org/settings/';

function TokenForm() {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    connectListenbrainz(token)
      .catch((e) =>
        setError(
          String(e) === 'invalid'
            ? 'settings.scrobbleTokenInvalid'
            : 'settings.scrobbleNetworkError',
        ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder={t('settings.scrobbleTokenPlaceholder')}
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-[12.5px] text-white/85 outline-none transition-colors placeholder:text-white/25 focus:border-[#eb743b]/60"
      />
      <p className={`text-[11.5px] leading-snug ${error ? 'text-[#ff6b5e]' : 'text-white/35'}`}>
        {t(error ?? 'settings.scrobbleTokenHint')}
      </p>
      <div className="flex flex-wrap gap-2">
        <TileButton brand="listenbrainz" submit disabled={busy || !token.trim()}>
          {busy && <Loader2 size={13} className="animate-spin" />}
          {t('settings.scrobbleConnect')}
        </TileButton>
        <TileButton onClick={() => void openUrl(TOKEN_PAGE).catch(() => undefined)}>
          <ExternalLink size={13} />
          {t('settings.scrobbleGetToken')}
        </TileButton>
      </div>
    </form>
  );
}

export function ListenbrainzTile({ status }: { status: ScrobbleServiceStatus }) {
  const { t } = useTranslation();
  const connected = Boolean(status.profile);
  return (
    <TileShell
      service="listenbrainz"
      tagline={t('settings.scrobbleListenbrainzTagline')}
      connected={connected}
    >
      {connected ? <AccountView service="listenbrainz" status={status} /> : <TokenForm />}
    </TileShell>
  );
}
