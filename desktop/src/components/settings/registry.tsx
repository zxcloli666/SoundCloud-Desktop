import type {ReactNode} from 'react';
import {Cloud, Database, Globe, Headphones, Link, Sparkles, User} from '../../lib/icons';
import {CallProxySection} from './CallProxySection';
import {AccountCard} from './cards/AccountCard';
import {AndroidCard} from './cards/AndroidCard';
import {AudioDeviceCard} from './cards/AudioDeviceCard';
import {BlockedArtistsCard} from './cards/BlockedArtistsCard';
import {CacheCard} from './cards/CacheCard';
import {CloseButtonCard} from './cards/CloseButtonCard';
import {CoverColorsCard} from './cards/CoverColorsCard';
import {CustomCssCard} from './cards/CustomCssCard';
import {DiagnosticsCard} from './cards/DiagnosticsCard';
import {DiscordCard} from './cards/DiscordCard';
import {FontCard} from './cards/FontCard';
import {HelpCard} from './cards/HelpCard';
import {HiddenKeywordsCard} from './cards/HiddenKeywordsCard';
import {HotkeysCard} from './cards/HotkeysCard';
import {ImportCard} from './cards/ImportCard';
import {ImportSyncCard} from './cards/ImportSyncCard';
import {LanguageCard} from './cards/LanguageCard';
import {LayoutCard} from './cards/LayoutCard';
import {MiniPlayerCard} from './cards/MiniPlayerCard';
import {NetCheckCard} from './cards/NetCheckCard';
import {NotificationsCard} from './cards/NotificationsCard';
import {ObsCard} from './cards/obs/ObsCard';
import {PerformanceCard} from './cards/PerformanceCard';
import {PlaybackCard} from './cards/PlaybackCard';
import {SoundForgeCard} from './cards/SoundForgeCard';
import {StartupCard} from './cards/StartupCard';
import {StorageLocationCard} from './cards/StorageLocationCard';
import {SupportCard} from './cards/SupportCard';
import {ScrobbleCard} from './cards/scrobble/ScrobbleCard';
import {ThemeCard} from './cards/ThemeCard';
import {ThemesCard} from './cards/ThemesCard';
import {UiScaleCard} from './cards/UiScaleCard';
import {UpdatesCard} from './cards/UpdatesCard';
import {WallpaperCard} from './cards/WallpaperCard';
import {Mic} from '../voice/icons';
import {VoiceSettings} from '../voice/VoiceSettings';

export type SettingsCategoryId =
    | 'general'
    | 'appearance'
    | 'audio'
    | 'voice'
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
                <BlockedArtistsCard/>
                <HiddenKeywordsCard/>
                <NotificationsCard/>
                <HelpCard/>
                <AndroidCard/>
                <SupportCard/>
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
                <ThemesCard/>
                <UiScaleCard/>
                <CoverColorsCard/>
                <FontCard/>
                <WallpaperCard/>
                <LayoutCard/>
                <MiniPlayerCard/>
                <PerformanceCard/>
                <CustomCssCard/>
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
        id: 'voice',
        labelKey: 'voice.category',
        icon: <Mic size={17}/>,
        Body: () => <VoiceSettings/>,
    },
    {
        id: 'network',
        labelKey: 'settings.catNetwork',
        icon: <Cloud size={17}/>,
        Body: () => (
            <>
                <NetCheckCard/>
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
                <ScrobbleCard/>
                <ObsCard/>
                <ImportCard/>
                <ImportSyncCard/>
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
