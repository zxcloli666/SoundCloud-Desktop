import {useTranslation} from 'react-i18next';
import {Headphones} from '../../../lib/icons';
import {useSubscription} from '../../../lib/subscription';
import {useAuthStore} from '../../../stores/auth';
import {type LyricsHighlight, useSettingsStore} from '../../../stores/settings';
import {Card, LockedToggle, PremiumBadge, Row, Segmented, Toggle} from '../primitives';

const HIGHLIGHTS: ReadonlyArray<{ id: LyricsHighlight; labelKey: string }> = [
    {id: 'word', labelKey: 'settings.lyricsHighlightWord'},
    {id: 'line', labelKey: 'settings.lyricsHighlightLine'},
];

export function PlaybackCard() {
    const {t} = useTranslation();
    const floatingComments = useSettingsStore((s) => s.floatingComments);
    const setFloatingComments = useSettingsStore((s) => s.setFloatingComments);
    const lyricsVisualizer = useSettingsStore((s) => s.lyricsVisualizer);
    const setLyricsVisualizer = useSettingsStore((s) => s.setLyricsVisualizer);
    const lyricsHighlight = useSettingsStore((s) => s.lyricsHighlight);
    const setLyricsHighlight = useSettingsStore((s) => s.setLyricsHighlight);
    const lightMode = useSettingsStore((s) => s.perfMode === 'light');
    const normalizeVolume = useSettingsStore((s) => s.normalizeVolume);
    const setNormalizeVolume = useSettingsStore((s) => s.setNormalizeVolume);
    const highQualityStreaming = useSettingsStore((s) => s.highQualityStreaming);
    const setHighQualityStreaming = useSettingsStore((s) => s.setHighQualityStreaming);

    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const {data: isPremium} = useSubscription(isAuthenticated);

    return (
        <Card title={t('settings.playback')} icon={<Headphones size={17}/>}>
            <div className="divide-y divide-white/[0.05]">
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
                <Row
                    title={t('settings.lyricsHighlight')}
                    desc={t(lightMode ? 'settings.lyricsHighlightLightDesc' : 'settings.lyricsHighlightDesc')}
                >
                    <div className="w-[260px]">
                        <Segmented
                            value={lyricsHighlight}
                            onChange={setLyricsHighlight}
                            options={HIGHLIGHTS.map((h) => ({id: h.id, label: t(h.labelKey)}))}
                        />
                    </div>
                </Row>
                <Row title={t('settings.normalizeVolume')} desc={t('settings.normalizeVolumeDesc')}>
                    <Toggle checked={normalizeVolume} onChange={() => setNormalizeVolume(!normalizeVolume)}/>
                </Row>
                <Row
                    title={t('settings.highQualityStreaming')}
                    desc={t('settings.highQualityStreamingDesc')}
                >
                    {isPremium ? (
                        <Toggle
                            checked={highQualityStreaming}
                            onChange={() => setHighQualityStreaming(!highQualityStreaming)}
                        />
                    ) : (
                        <>
                            <PremiumBadge/>
                            <LockedToggle/>
                        </>
                    )}
                </Row>
            </div>
        </Card>
    );
}
