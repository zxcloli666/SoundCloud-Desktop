import {useTranslation} from 'react-i18next';
import {Headphones} from '../../../lib/icons';
import {useSubscription} from '../../../lib/subscription';
import {useAuthStore} from '../../../stores/auth';
import {useSettingsStore} from '../../../stores/settings';
import {Card, Row, Toggle} from '../primitives';
import {StreamQualityPicker} from './StreamQualityPicker';

export function PlaybackCard() {
    const {t} = useTranslation();
    const floatingComments = useSettingsStore((s) => s.floatingComments);
    const setFloatingComments = useSettingsStore((s) => s.setFloatingComments);
    const lyricsVisualizer = useSettingsStore((s) => s.lyricsVisualizer);
    const setLyricsVisualizer = useSettingsStore((s) => s.setLyricsVisualizer);
    const normalizeVolume = useSettingsStore((s) => s.normalizeVolume);
    const setNormalizeVolume = useSettingsStore((s) => s.setNormalizeVolume);

    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const {data: isPremium} = useSubscription(isAuthenticated);

    return (
        <Card title={t('settings.playback')} icon={<Headphones size={17}/>}>
            <div className="divide-y divide-white/[0.05]">
                <StreamQualityPicker isPremium={!!isPremium}/>
                <Row title={t('settings.floatingComments')} desc={t('settings.floatingCommentsDesc')}>
                    <Toggle
                        checked={floatingComments}
                        onChange={() => setFloatingComments(!floatingComments)}
                    />
                </Row>
                <Row title={t('settings.lyricsVisualizer')} desc={t('settings.lyricsVisualizerDesc')}>
                    <Toggle
                        checked={lyricsVisualizer}
                        onChange={() => setLyricsVisualizer(!lyricsVisualizer)}
                    />
                </Row>
                <Row title={t('settings.normalizeVolume')} desc={t('settings.normalizeVolumeDesc')}>
                    <Toggle checked={normalizeVolume} onChange={() => setNormalizeVolume(!normalizeVolume)}/>
                </Row>
            </div>
        </Card>
    );
}
