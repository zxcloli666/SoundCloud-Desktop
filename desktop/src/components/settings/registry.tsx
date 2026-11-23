import type { ReactNode } from 'react';
import { MessagesSquare } from '../../lib/chat/icons';
import {
  Braces,
  Database,
  Film,
  Globe,
  Headphones,
  Info,
  Link,
  SlidersHorizontal,
  Sparkles,
  User,
  Wifi,
} from '../../lib/icons';
import { ChatSettings } from '../chat/settings/ChatSettings';
import { Mic } from '../voice/icons';
import { VoiceSettings } from '../voice/VoiceSettings';
import { CallProxySection } from './CallProxySection';
import { AccountCard } from './cards/AccountCard';
import { AndroidCard } from './cards/AndroidCard';
import { AudioDeviceCard } from './cards/AudioDeviceCard';
import { BlockedArtistsCard } from './cards/BlockedArtistsCard';
import { CacheCard } from './cards/CacheCard';
import { CloseButtonCard } from './cards/CloseButtonCard';
import { CoverColorsCard } from './cards/CoverColorsCard';
import { CustomCssCard } from './cards/CustomCssCard';
import { DiagnosticsCard } from './cards/DiagnosticsCard';
import { DiscordCard } from './cards/DiscordCard';
import { FontCard } from './cards/FontCard';
import { HelpCard } from './cards/HelpCard';
import { HiddenKeywordsCard } from './cards/HiddenKeywordsCard';
import { HotkeysCard } from './cards/HotkeysCard';
import { ImportCard } from './cards/ImportCard';
import { ImportSyncCard } from './cards/ImportSyncCard';
import { LanguageCard } from './cards/LanguageCard';
import { LayoutCard } from './cards/LayoutCard';
import { LyricsCard } from './cards/LyricsCard';
import { MiniPlayerCard } from './cards/MiniPlayerCard';
import { NetCheckCard } from './cards/NetCheckCard';
import { NotificationsCard } from './cards/NotificationsCard';
import { ObsCard } from './cards/obs/ObsCard';
import { PerformanceCard } from './cards/PerformanceCard';
import { PlaybackCard } from './cards/PlaybackCard';
import { SoundCard } from './cards/SoundCard';
import { SoundForgeCard } from './cards/SoundForgeCard';
import { StartupCard } from './cards/StartupCard';
import { StorageLocationCard } from './cards/StorageLocationCard';
import { SupportCard } from './cards/SupportCard';
import { ScrobbleCard } from './cards/scrobble/ScrobbleCard';
import { ThemeCard } from './cards/ThemeCard';
import { ThemesCard } from './cards/ThemesCard';
import { UiScaleCard } from './cards/UiScaleCard';
import { UpdatesCard } from './cards/UpdatesCard';
import { VideoCard } from './cards/VideoCard';
import { WallpaperCard } from './cards/WallpaperCard';

export type SettingsCategoryId =
  | 'general'
  | 'appearance'
  | 'audio'
  | 'voice'
  | 'chats'
  | 'account'
  | 'advanced'
  | 'about';

export interface SettingsPage {
  id: string;
  labelKey: string;
  icon: ReactNode;
  Body: () => ReactNode;
}

interface CategoryHead {
  id: SettingsCategoryId;
  labelKey: string;
  summaryKey: string;
  icon: ReactNode;
  rare?: boolean;
}

export type SettingsCategory = CategoryHead &
  ({ Body: () => ReactNode } | { pages: SettingsPage[] });

const ICON = 17;

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'general',
    labelKey: 'settings.catGeneral',
    summaryKey: 'settings.sumGeneral',
    icon: <Globe size={ICON} />,
    Body: () => (
      <>
        <LanguageCard />
        <StartupCard />
        <CloseButtonCard />
        <NotificationsCard />
        <HotkeysCard />
        <BlockedArtistsCard />
        <HiddenKeywordsCard />
      </>
    ),
  },
  {
    id: 'appearance',
    labelKey: 'settings.catAppearance',
    summaryKey: 'settings.sumAppearance',
    icon: <Sparkles size={ICON} />,
    Body: () => (
      <>
        <ThemeCard />
        <ThemesCard />
        <WallpaperCard />
        <FontCard />
        <UiScaleCard />
        <CoverColorsCard />
        <LayoutCard />
        <MiniPlayerCard />
        <PerformanceCard />
      </>
    ),
  },
  {
    id: 'audio',
    labelKey: 'settings.catAudio',
    summaryKey: 'settings.sumAudio',
    icon: <Headphones size={ICON} />,
    Body: () => (
      <>
        <SoundCard />
        <PlaybackCard />
        <LyricsCard />
        <AudioDeviceCard />
      </>
    ),
  },
  {
    id: 'voice',
    labelKey: 'voice.category',
    summaryKey: 'settings.sumVoice',
    icon: <Mic size={ICON} />,
    Body: () => <VoiceSettings />,
  },
  {
    id: 'chats',
    labelKey: 'chat.settings.title',
    summaryKey: 'settings.sumChats',
    icon: <MessagesSquare size={ICON} />,
    Body: () => <ChatSettings />,
  },
  {
    id: 'account',
    labelKey: 'settings.catAccount',
    summaryKey: 'settings.sumAccount',
    icon: <User size={ICON} />,
    Body: () => <AccountCard />,
  },
  {
    id: 'advanced',
    labelKey: 'settings.catAdvanced',
    summaryKey: 'settings.sumAdvanced',
    icon: <SlidersHorizontal size={ICON} />,
    rare: true,
    pages: [
      {
        id: 'network',
        labelKey: 'settings.catNetwork',
        icon: <Wifi size={15} />,
        Body: () => (
          <>
            <NetCheckCard />
            <CallProxySection />
          </>
        ),
      },
      {
        id: 'integrations',
        labelKey: 'settings.catIntegrations',
        icon: <Link size={15} />,
        Body: () => (
          <>
            <DiscordCard />
            <ScrobbleCard />
            <ObsCard />
            <ImportCard />
            <ImportSyncCard />
          </>
        ),
      },
      {
        id: 'storage',
        labelKey: 'settings.catStorage',
        icon: <Database size={15} />,
        Body: () => (
          <>
            <CacheCard />
            <StorageLocationCard />
            <SoundForgeCard />
          </>
        ),
      },
      {
        id: 'video',
        labelKey: 'settings.video',
        icon: <Film size={15} />,
        Body: () => <VideoCard />,
      },
      {
        id: 'css',
        labelKey: 'settings.customCssTitle',
        icon: <Braces size={15} />,
        Body: () => <CustomCssCard />,
      },
    ],
  },
  {
    id: 'about',
    labelKey: 'settings.catAbout',
    summaryKey: 'settings.sumAbout',
    icon: <Info size={ICON} />,
    rare: true,
    Body: () => (
      <>
        <UpdatesCard />
        <HelpCard />
        <SupportCard />
        <AndroidCard />
        <DiagnosticsCard />
      </>
    ),
  },
];

export function pagesOf(category: SettingsCategory): SettingsPage[] {
  return 'pages' in category ? category.pages : [category];
}

export function findPlace(
  categories: SettingsCategory[],
  id: string | undefined,
): { category: SettingsCategory; page: SettingsPage } | null {
  for (const category of categories) {
    if (category.id === id) return { category, page: pagesOf(category)[0] };
    const page = pagesOf(category).find((item) => item.id === id);
    if (page) return { category, page };
  }
  return null;
}

export function pageIcon(id: string): ReactNode {
  return findPlace(SETTINGS_CATEGORIES, id)?.page.icon;
}
