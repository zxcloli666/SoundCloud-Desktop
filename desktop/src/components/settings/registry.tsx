import type { ReactNode } from 'react';
import { Database, Globe, Headphones, Link, Sparkles, User } from '../../lib/icons';
import { AccountCard } from './cards/AccountCard';
import { AudioDeviceCard } from './cards/AudioDeviceCard';
import { CacheCard } from './cards/CacheCard';
import { DiscordCard } from './cards/DiscordCard';
import { ImportCard } from './cards/ImportCard';
import { LanguageCard } from './cards/LanguageCard';
import { PerformanceCard } from './cards/PerformanceCard';
import { PlaybackCard } from './cards/PlaybackCard';
import { SoundForgeCard } from './cards/SoundForgeCard';
import { StartupCard } from './cards/StartupCard';
import { ThemeCard } from './cards/ThemeCard';
import { WallpaperCard } from './cards/WallpaperCard';

export type SettingsCategoryId =
  | 'general'
  | 'appearance'
  | 'audio'
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
    icon: <Globe size={17} />,
    Body: () => (
      <>
        <LanguageCard />
        <StartupCard />
      </>
    ),
  },
  {
    id: 'appearance',
    labelKey: 'settings.catAppearance',
    icon: <Sparkles size={17} />,
    Body: () => (
      <>
        <ThemeCard />
        <WallpaperCard />
        <PerformanceCard />
      </>
    ),
  },
  {
    id: 'audio',
    labelKey: 'settings.catAudio',
    icon: <Headphones size={17} />,
    Body: () => (
      <>
        <PlaybackCard />
        <AudioDeviceCard />
      </>
    ),
  },
  {
    id: 'integrations',
    labelKey: 'settings.catIntegrations',
    icon: <Link size={17} />,
    Body: () => (
      <>
        <DiscordCard />
        <ImportCard />
      </>
    ),
  },
  {
    id: 'storage',
    labelKey: 'settings.catStorage',
    icon: <Database size={17} />,
    Body: () => (
      <>
        <SoundForgeCard />
        <CacheCard />
      </>
    ),
  },
  {
    id: 'account',
    labelKey: 'settings.catAccount',
    icon: <User size={17} />,
    Body: () => <AccountCard />,
  },
];
