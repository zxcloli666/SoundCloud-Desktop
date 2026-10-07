import {useTranslation} from 'react-i18next';
import {MessageCircle} from '../../../lib/icons';
import {getArtistDisplay, getDisplayTitle} from '../../../lib/track-display';
import {useDiscordStatusStore} from '../../../stores/discord-status';
import {usePlayerStore} from '../../../stores/player';
import {type DiscordRpcMode, type DiscordRpcStatus, useSettingsStore} from '../../../stores/settings';
import {Card, Row, Segmented, Toggle} from '../primitives';

const MODES: Array<{ id: DiscordRpcMode; labelKey: string }> = [
    {id: 'track', labelKey: 'settings.discordRpcModeTrack'},
    {id: 'artist', labelKey: 'settings.discordRpcModeArtist'},
    {id: 'activity', labelKey: 'settings.discordRpcModeActivity'},
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

function StatusPreview({shown}: { shown: DiscordRpcStatus }) {
    const {t} = useTranslation();
    const track = usePlayerStore((s) => s.currentTrack);
    const title = track ? getDisplayTitle(track) : t('settings.discordRpcStatusSampleTrack');
    const artist = track
        ? getArtistDisplay(track).primary || track.user?.username || ''
        : t('settings.discordRpcStatusSampleArtist');
    const value = shown === 'app' ? 'SoundCloud' : shown === 'track' ? title : artist;

    return (
        <div
            className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
            <span className="size-2 shrink-0 rounded-full bg-[#23a55a] shadow-[0_0_8px_#23a55a]"/>
            <p className="min-w-0 truncate text-[12.5px] text-white/50">
                {t('settings.discordRpcStatusListening')}{' '}
                <span className="font-semibold text-white/85">{value}</span>
            </p>
        </div>
    );
}

export function DiscordCard() {
    const {t} = useTranslation();
    const enabled = useSettingsStore((s) => s.discordRpcEnabled);
    const setEnabled = useSettingsStore((s) => s.setDiscordRpcEnabled);
    const mode = useSettingsStore((s) => s.discordRpcMode);
    const setMode = useSettingsStore((s) => s.setDiscordRpcMode);
    const status = useSettingsStore((s) => s.discordRpcStatus);
    const setStatus = useSettingsStore((s) => s.setDiscordRpcStatus);
    const showButton = useSettingsStore((s) => s.discordRpcShowButton);
    const setShowButton = useSettingsStore((s) => s.setDiscordRpcShowButton);
    const connection = useDiscordStatusStore((s) => s.status);
    const shown = effectiveStatus(mode, status);
    const choices = statusOptions(mode);

    return (
        <Card
            title={t('settings.discordRpc')}
            desc={t('settings.discordRpcDesc')}
            icon={<MessageCircle size={17}/>}
            action={<Toggle checked={enabled} onChange={() => setEnabled(!enabled)}/>}
        >
            {enabled ? (
                <div className="space-y-4">
                    <div className="space-y-1">
                        {connection !== 'idle' && (
                            <p className="text-[12.5px] text-white/60 font-medium">
                                {t(
                                    connection === 'connected'
                                        ? 'settings.discordRpcConnected'
                                        : 'settings.discordRpcUnavailable',
                                )}
                            </p>
                        )}
                        <p className="text-[11.5px] text-white/35 leading-snug">
                            {t('settings.discordRpcHint')}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[12.5px] text-white/50 font-medium">
                            {t('settings.discordRpcMode')}
                        </p>
                        <Segmented
                            value={mode}
                            columns={3}
                            onChange={setMode}
                            options={MODES.map((m) => ({id: m.id, label: t(m.labelKey)}))}
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="space-y-0.5">
                            <p className="text-[12.5px] text-white/50 font-medium">
                                {t('settings.discordRpcStatus')}
                            </p>
                            <p className="text-[11.5px] text-white/35 leading-snug">
                                {t(
                                    mode === 'activity'
                                        ? 'settings.discordRpcStatusActivityHint'
                                        : 'settings.discordRpcStatusDesc',
                                )}
                            </p>
                        </div>
                        {mode !== 'activity' && (
                            <Segmented
                                value={shown}
                                columns={choices.length}
                                onChange={setStatus}
                                options={choices.map((id) => ({id, label: t(STATUS_LABELS[id])}))}
                            />
                        )}
                        <StatusPreview shown={shown}/>
                    </div>
                    <Row title={t('settings.discordRpcButton')} desc={t('settings.discordRpcButtonDesc')}>
                        <Toggle checked={showButton} onChange={() => setShowButton(!showButton)}/>
                    </Row>
                </div>
            ) : null}
        </Card>
    );
}
