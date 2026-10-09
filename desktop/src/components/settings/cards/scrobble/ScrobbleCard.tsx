import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines } from '../../../../lib/icons';
import {
  loadScrobbleStatus,
  refreshScrobbleProfiles,
  resumeLastfmAuthCheck,
} from '../../../../lib/scrobble/client';
import { hasScrobbleAccount, useScrobbleStore } from '../../../../stores/scrobble';
import { useSettingsStore } from '../../../../stores/settings';
import { Card, Row, Toggle } from '../../primitives';
import { LastfmTile } from './LastfmTile';
import { ListenbrainzTile } from './ListenbrainzTile';
import { LivePanel } from './LivePanel';

export function ScrobbleCard() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.scrobbleEnabled);
  const setEnabled = useSettingsStore((s) => s.setScrobbleEnabled);
  const nowPlaying = useSettingsStore((s) => s.scrobbleNowPlaying);
  const setNowPlaying = useSettingsStore((s) => s.setScrobbleNowPlaying);
  const status = useScrobbleStore((s) => s.status);
  const linked = hasScrobbleAccount(status);

  useEffect(() => {
    void loadScrobbleStatus().then(refreshScrobbleProfiles);
    window.addEventListener('focus', resumeLastfmAuthCheck);
    return () => window.removeEventListener('focus', resumeLastfmAuthCheck);
  }, []);

  return (
    <Card
      title={t('settings.scrobble')}
      desc={t('settings.scrobbleDesc')}
      icon={<AudioLines size={17} />}
      action={<Toggle checked={enabled} onChange={() => setEnabled(!enabled)} />}
    >
      <div className="space-y-4">
        {status && (
          <div className="grid gap-3 sm:grid-cols-2">
            <LastfmTile status={status.lastfm} />
            <ListenbrainzTile status={status.listenbrainz} />
          </div>
        )}
        {linked && <LivePanel paused={!enabled} />}
        {linked && (
          <Row title={t('settings.scrobbleNowPlaying')} desc={t('settings.scrobbleNowPlayingDesc')}>
            <Toggle
              checked={nowPlaying}
              disabled={!enabled}
              onChange={() => setNowPlaying(!nowPlaying)}
            />
          </Row>
        )}
        <p className="text-[11.5px] leading-snug text-white/30">{t('settings.scrobbleRules')}</p>
      </div>
    </Card>
  );
}
