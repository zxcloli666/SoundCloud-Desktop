import type { Entity, EntityKind } from '../types';
import type { Brief } from './context';
import type { Page, SettingsSection } from './pages';
import type { SettingKey, SettingValue } from './settings';

export type OpenResult = 'ok' | 'nothing_playing' | 'no_page';

export interface AppPort {
  resolve(query: string, kinds: EntityKind[]): Promise<Entity[]>;
  open(page: Page, query: string, section: SettingsSection | null): OpenResult;
  setSpeed(rate: number): number;
  showLyrics(open: boolean): void;
  upNext(limit: number): Brief[];
  clearQueue(): void;
  pickPlaylist(): boolean;
  settings(): Record<SettingKey, SettingValue>;
  applySetting(key: SettingKey, value: SettingValue): void;
  remember(note: string): boolean;
  forget(note: string): number;
}
