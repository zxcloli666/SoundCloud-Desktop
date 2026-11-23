import { useTranslation } from 'react-i18next';
import { MessageCircle, MicVocal } from '../../../lib/icons';
import { getArtistDisplay, getDisplayTitle } from '../../../lib/track-display';
import { useDiscordStatusStore } from '../../../stores/discord-status';
import { usePlayerStore } from '../../../stores/player';
import {
  type DiscordRpcMode,
  type DiscordRpcStatus,
  useSettingsStore,
} from '../../../stores/settings';
import { Card, Info, Row, Segmented, Toggle } from '../primitives';

const MODES: Array<{ id: DiscordRpcMode; labelKey: string }> = [
  { id: 'track', labelKey: 'settings.discordRpcModeTrack' },
  { id: 'artist', labelKey: 'settings.discordRpcModeArtist' },
  { id: 'activity', labelKey: 'settings.discordRpcModeActivity' },
];

const STATUS_LABELS: Record<DiscordRpcStatus, string> = {
  app: 'settings.discordRpcStatusApp',
  track: 'settings.discordRpcStatusTrack',
  artist: 'settings.discordRpcStatusArtist',
};

function statusOptions(mode: DiscordRpcMode): DiscordRpcStatus[] {
  return mode === 'track' ? ['app', 'track', 'artist'] : ['app', 'artist'];
}

function effectiveStatus(mode: DiscordRpcMode, status: DiscordRpcStatus): DiscordRpcStatus {
  if (mode === 'activity') return 'app';
  if (mode === 'artist' && status === 'track') return 'artist';
  return status;
}

function StatusPreview({ shown }: { shown: DiscordRpcStatus }) {
  const { t } = useTranslation();
  const track = usePlayerStore((s) => s.currentTrack);
  const title = track ? getDisplayTitle(track) : t('settings.discordRpcStatusSampleTrack');
  const artist = track
    ? getArtistDisplay(track).primary || track.user?.username || ''
    : t('settings.discordRpcStatusSampleArtist');
  const value = shown === 'app' ? 'SoundCloud' : shown === 'track' ? title : artist;

  return (
    <div className="flex items-center gap-2.5 rounded-[10px] bg-[var(--set-well)] px-3 py-2.5">
      <span className="size-2 shrink-0 rounded-full bg-[#23a55a]" />
      <p className="min-w-0 truncate text-[12.5px] text-ink-50">
        {t('settings.discordRpcStatusListening')}{' '}
        <span className="font-semibold text-ink-85">{value}</span>
      </p>
    </div>
  );
}

function LyricsPreview() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] bg-[var(--set-well)] px-3 py-2.5">
      <MicVocal size={14} className="shrink-0 text-ink-40" />
      <p className="min-w-0 truncate text-[12.5px] italic text-ink-70">
        {t('settings.discordRpcLyricsSample')}
      </p>
    </div>
  );
}

export function DiscordCard() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.discordRpcEnabled);
  const setEnabled = useSettingsStore((s) => s.setDiscordRpcEnabled);
  const mode = useSettingsStore((s) => s.discordRpcMode);
  const setMode = useSettingsStore((s) => s.setDiscordRpcMode);
  const status = useSettingsStore((s) => s.discordRpcStatus);
  const setStatus = useSettingsStore((s) => s.setDiscordRpcStatus);
  const showButton = useSettingsStore((s) => s.discordRpcShowButton);
  const setShowButton = useSettingsStore((s) => s.setDiscordRpcShowButton);
  const hidePaused = useSettingsStore((s) => s.discordRpcHidePaused);
  const setHidePaused = useSettingsStore((s) => s.setDiscordRpcHidePaused);
  const lyrics = useSettingsStore((s) => s.discordRpcLyrics);
  const setLyrics = useSettingsStore((s) => s.setDiscordRpcLyrics);
  const connection = useDiscordStatusStore((s) => s.status);
  const shown = effectiveStatus(mode, status);
  const choices = statusOptions(mode);
  const lyricsAvailable = mode !== 'activity';

  return (
    <Card
      title={t('settings.discordRpc')}
      desc={t('settings.discordRpcDesc')}
      icon={<MessageCircle size={17} />}
      action={
        <Toggle
          checked={enabled}
          onChange={() => setEnabled(!enabled)}
          label={t('settings.discordRpc')}
        />
      }
    >
      {enabled && (
        <>
          <div className="set-row flex min-h-[44px] items-center gap-2 py-2.5 text-[12.5px]">
            {connection === 'idle' ? (
              <span className="min-w-0 text-ink-50">{t('settings.discordRpcHint')}</span>
            ) : (
              <>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${connection === 'connected' ? 'bg-ok' : 'bg-amber-400'}`}
                />
                <span className="min-w-0 truncate text-ink-80">
                  {t(
                    connection === 'connected'
                      ? 'settings.discordRpcConnected'
                      : 'settings.discordRpcUnavailable',
                  )}
                </span>
                <Info text={t('settings.discordRpcHint')} />
              </>
            )}
          </div>
          <Row title={t('settings.discordRpcMode')}>
            <Segmented
              value={mode}
              onChange={setMode}
              options={MODES.map((m) => ({ id: m.id, label: t(m.labelKey) }))}
            />
          </Row>
          <Row
            title={t('settings.discordRpcStatus')}
            desc={mode === 'activity' ? t('settings.discordRpcStatusActivityHint') : undefined}
            info={mode === 'activity' ? undefined : t('settings.discordRpcStatusDesc')}
            stacked
          >
            <div className="flex flex-col gap-2.5">
              {mode !== 'activity' && (
                <Segmented
                  value={shown}
                  full
                  onChange={setStatus}
                  options={choices.map((id) => ({ id, label: t(STATUS_LABELS[id]) }))}
                />
              )}
              <StatusPreview shown={shown} />
            </div>
          </Row>
          <Row
            title={t('settings.discordRpcLyrics')}
            desc={lyricsAvailable ? undefined : t('settings.discordRpcLyricsActivityHint')}
            info={lyricsAvailable ? t('settings.discordRpcLyricsDesc') : undefined}
            value={
              <Toggle
                checked={lyrics && lyricsAvailable}
                disabled={!lyricsAvailable}
                onChange={() => setLyrics(!lyrics)}
                label={t('settings.discordRpcLyrics')}
              />
            }
            stacked
          >
            {lyrics && lyricsAvailable && <LyricsPreview />}
          </Row>
          <Row
            title={t('settings.discordRpcHidePaused')}
            desc={t('settings.discordRpcHidePausedDesc')}
          >
            <Toggle
              checked={hidePaused}
              onChange={() => setHidePaused(!hidePaused)}
              label={t('settings.discordRpcHidePaused')}
            />
          </Row>
          <Row title={t('settings.discordRpcButton')} desc={t('settings.discordRpcButtonDesc')}>
            <Toggle
              checked={showButton}
              onChange={() => setShowButton(!showButton)}
              label={t('settings.discordRpcButton')}
            />
          </Row>
        </>
      )}
    </Card>
  );
}
