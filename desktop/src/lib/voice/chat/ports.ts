import type { ItemKind, Screen, ScrollTo } from '../screen/shape';
import type { Listed, TrackList } from '../track-lists';
import type { Entity, EntityKind } from '../types';
import type { Brief } from './context';
import type { Forgot, Kept } from './notes';
import type { Page, SettingsSection } from './pages';
import type { SettingKey, SettingValue } from './settings';

export type OpenResult = 'ok' | 'nothing_playing' | 'no_page';

export type SleepPlan = { minutes: number } | 'track_end' | 'off';

export const EFFECTS = ['off', 'slowed_reverb', 'sped_up', 'eight_d', 'bass'] as const;
export type EffectName = (typeof EFFECTS)[number];

export type Taste = 'ok' | 'nothing_playing' | 'local_track' | 'quota_full' | 'failed';

export type TogetherAct = 'start' | 'join' | 'invite' | 'leave';
export type TogetherDone =
  | { state: 'ok'; code: string | null }
  | { state: 'no_room' | 'in_room' | 'bad_code' | 'failed' };

export interface AppPort {
  resolve(query: string, kinds: EntityKind[]): Promise<Entity[]>;
  open(page: Page, query: string, section: SettingsSection | null): OpenResult;
  setSpeed(rate: number): number;
  showLyrics(open: boolean): void;
  upNext(limit: number): Brief[];
  listTracks(list: TrackList, from: number, count: number, artist?: string): Promise<Listed[]>;
  clearQueue(): void;
  screen(): Promise<Screen>;
  press(ref: string): boolean;
  typeInto(ref: string, text: string, submit: boolean): boolean;
  scroll(to: ScrollTo): Promise<Screen | null>;
  playRow(n: number): boolean;
  openItem(kind: ItemKind, id: string): boolean;
  pickPlaylist(): boolean;
  settings(): Record<SettingKey, SettingValue>;
  applySetting(key: SettingKey, value: SettingValue): void;
  remember(note: string): Kept;
  forget(note: string): Forgot;
  setSleep(plan: SleepPlan): void;
  setEffect(effect: EffectName): void;
  dislike(on: boolean): Promise<Taste>;
  superlike(on: boolean): Taste;
  together(act: TogetherAct, code: string, open: boolean): Promise<TogetherDone>;
}
