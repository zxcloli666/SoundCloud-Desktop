import {useTranslation} from 'react-i18next';
import {Headphones} from '../../../lib/icons';
import {useSubscription} from '../../../lib/subscription';
import {useAuthStore} from '../../../stores/auth';
import {type LyricsHighlight, useSettingsStore} from '../../../stores/settings';
import {Card, Row, Segmented, Toggle} from '../primitives';
import {CrossfadePicker} from './CrossfadePicker';
import {SearchPlaybackPicker} from './SearchPlaybackPicker';
import {SkipStuckPicker} from './SkipStuckPicker';
import {StreamQualityPicker} from './StreamQualityPicker';

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
    const skipSilence = useSettingsStore((s) => s.skipSilence);
    const setSkipSilence = useSettingsStore((s) => s.setSkipSilence);
    const autoplay = useSettingsStore((s) => s.autoplay);
    const setAutoplay = useSettingsStore((s) => s.setAutoplay);

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
                <Row title={t('settings.skipSilence')} desc={t('settings.skipSilenceDesc')}>
                    <Toggle checked={skipSilence} onChange={() => setSkipSilence(!skipSilence)}/>
                </Row>
                <Row title={t('settings.autoplay')} desc={t('settings.autoplayDesc')}>
                    <Toggle checked={autoplay} onChange={() => setAutoplay(!autoplay)}/>
                </Row>
                <SearchPlaybackPicker/>
                <CrossfadePicker/>
                <SkipStuckPicker/>
            </div>
        </Card>
    );
}
