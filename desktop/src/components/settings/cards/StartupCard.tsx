import {useTranslation} from 'react-i18next';
import {Home} from '../../../lib/icons';
import {type StartupPage, useSettingsStore} from '../../../stores/settings';
import {Card, Segmented} from '../primitives';
import {AutostartRows} from './AutostartRows';

const PAGES: Array<{ id: StartupPage; labelKey: string }> = [
    {id: 'home', labelKey: 'nav.home'},
    {id: 'search', labelKey: 'nav.search'},
    {id: 'library', labelKey: 'nav.library'},
    {id: 'settings', labelKey: 'nav.settings'},
];

export function StartupCard() {
    const {t} = useTranslation();
    const startupPage = useSettingsStore((s) => s.startupPage);
    const setStartupPage = useSettingsStore((s) => s.setStartupPage);

    return (
        <Card
            title={t('settings.startup')}
            desc={t('settings.startupPageDesc')}
            icon={<Home size={17}/>}
        >
            <Segmented
                value={startupPage}
                columns={4}
                onChange={setStartupPage}
                options={PAGES.map((p) => ({id: p.id, label: t(p.labelKey)}))}
            />
            <AutostartRows/>
        </Card>
    );
}
