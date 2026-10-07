import type {ReactNode} from 'react';
import {Cloud, Database, Globe, Headphones, Link, Sparkles, User} from '../../lib/icons';
import {CallProxySection} from './CallProxySection';
import {AccountCard} from './cards/AccountCard';
import {AudioDeviceCard} from './cards/AudioDeviceCard';
import {CacheCard} from './cards/CacheCard';
import {CloseButtonCard} from './cards/CloseButtonCard';
import {DiagnosticsCard} from './cards/DiagnosticsCard';
import {DiscordCard} from './cards/DiscordCard';
import {HotkeysCard} from './cards/HotkeysCard';
import {ImportCard} from './cards/ImportCard';
import {LanguageCard} from './cards/LanguageCard';
import {NetworkCard} from './cards/NetworkCard';
import {PerformanceCard} from './cards/PerformanceCard';
import {PlaybackCard} from './cards/PlaybackCard';
import {SoundForgeCard} from './cards/SoundForgeCard';
import {StartupCard} from './cards/StartupCard';
import {StorageLocationCard} from './cards/StorageLocationCard';
import {ThemeCard} from './cards/ThemeCard';
import {UiScaleCard} from './cards/UiScaleCard';
import {UpdatesCard} from './cards/UpdatesCard';
import {WallpaperCard} from './cards/WallpaperCard';

export type SettingsCategoryId =
    | 'general'
    | 'appearance'
    | 'audio'
    | 'network'
    | 'integrations'
    | 'storage'
    | 'account';

export interface SettingsCategory {
    id: SettingsCategoryId;
    labelKey: string;
    icon: ReactNode;
    Body: () => ReactNode;
}

/** The settings map — one entry per left-rail category, each composing small cards. */
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
    {
        id: 'general',
        labelKey: 'settings.catGeneral',
        icon: <Globe size={17}/>,
        Body: () => (
            <>
                <LanguageCard/>
                <StartupCard/>
                <CloseButtonCard/>
                <HotkeysCard/>
                <UpdatesCard/>
                <DiagnosticsCard/>
            </>
        ),
    },
    {
        id: 'appearance',
        labelKey: 'settings.catAppearance',
        icon: <Sparkles size={17}/>,
        Body: () => (
            <>
                <ThemeCard/>
                <UiScaleCard/>
                <WallpaperCard/>
                <PerformanceCard/>
            </>
        ),
    },
    {
        id: 'audio',
        labelKey: 'settings.catAudio',
        icon: <Headphones size={17}/>,
        Body: () => (
            <>
                <PlaybackCard/>
                <AudioDeviceCard/>
            </>
        ),
    },
    {
        id: 'network',
        labelKey: 'settings.catNetwork',
        icon: <Cloud size={17}/>,
        Body: () => (
            <>
                <NetworkCard/>
                <CallProxySection/>
            </>
        ),
    },
    {
        id: 'integrations',
        labelKey: 'settings.catIntegrations',
        icon: <Link size={17}/>,
        Body: () => (
            <>
                <DiscordCard/>
                <ImportCard/>
            </>
        ),
    },
    {
        id: 'storage',
        labelKey: 'settings.catStorage',
        icon: <Database size={17}/>,
        Body: () => (
            <>
                <SoundForgeCard/>
                <CacheCard/>
                <StorageLocationCard/>
            </>
        ),
    },
    {
        id: 'account',
        labelKey: 'settings.catAccount',
        icon: <User size={17}/>,
        Body: () => <AccountCard/>,
    },
];
