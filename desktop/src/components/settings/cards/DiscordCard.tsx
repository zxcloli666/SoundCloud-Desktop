import {useTranslation} from 'react-i18next';
import {MessageCircle} from '../../../lib/icons';
import {useDiscordStatusStore} from '../../../stores/discord-status';
import {type DiscordRpcMode, useSettingsStore} from '../../../stores/settings';
import {Card, Row, Segmented, Toggle} from '../primitives';

const MODES: Array<{ id: DiscordRpcMode; labelKey: string }> = [
    {id: 'track', labelKey: 'settings.discordRpcModeTrack'},
    {id: 'artist', labelKey: 'settings.discordRpcModeArtist'},
    {id: 'activity', labelKey: 'settings.discordRpcModeActivity'},
];

export function DiscordCard() {
    const {t} = useTranslation();
    const enabled = useSettingsStore((s) => s.discordRpcEnabled);
    const setEnabled = useSettingsStore((s) => s.setDiscordRpcEnabled);
    const mode = useSettingsStore((s) => s.discordRpcMode);
    const setMode = useSettingsStore((s) => s.setDiscordRpcMode);
    const showButton = useSettingsStore((s) => s.discordRpcShowButton);
    const setShowButton = useSettingsStore((s) => s.setDiscordRpcShowButton);
    const status = useDiscordStatusStore((s) => s.status);

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
                        {status !== 'idle' && (
                            <p className="text-[12.5px] text-white/60 font-medium">
                                {t(
                                    status === 'connected'
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
                    <Row title={t('settings.discordRpcButton')} desc={t('settings.discordRpcButtonDesc')}>
                        <Toggle checked={showButton} onChange={() => setShowButton(!showButton)}/>
                    </Row>
                </div>
            ) : null}
        </Card>
    );
}
