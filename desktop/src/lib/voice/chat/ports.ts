import type { ButtonAct, PlacementMap, Zone } from '../../player-zones';
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

export const SOUND_VIEWS = ['all', 'equalizer', 'effects'] as const;
export type SoundView = (typeof SOUND_VIEWS)[number];

export type Taste = 'ok' | 'nothing_playing' | 'local_track' | 'quota_full' | 'failed';

export const TOGETHER_ACTS = ['start', 'join', 'invite', 'visibility', 'leave'] as const;
export type TogetherAct = (typeof TOGETHER_ACTS)[number];

export interface TogetherAsk {
  act: TogetherAct;
  code: string;
  host: string;
  open: boolean;
}

export type TogetherDone =
  | { state: 'ok'; code: string | null }
  | {
      state:
        | 'no_room'
        | 'in_room'
        | 'bad_code'
        | 'no_open_room'
        | 'room_full'
        | 'not_host'
        | 'failed';
    };

export interface OpenRoomShown {
  host: string;
  track: string | null;
  listeners: number;
  capacity: number;
  full: boolean;
}

export const STATIONS = [
  'same_vibe',
  'deep_cuts',
  'adjacent',
  'top_artists',
  'fresh_drops',
] as const;
export type Station = (typeof STATIONS)[number];

export const BUTTON_PLACES = ['bar', 'home'] as const;
export type ButtonPlace = (typeof BUTTON_PLACES)[number];

export interface ButtonAsk {
  place: ButtonPlace | null;
  button: string;
  act: ButtonAct;
  zone: string | null;
  position: number | null;
}

export type ButtonDone =
  | { state: 'ok'; place: ButtonPlace; zone: Zone; position: number; hidden: boolean }
  | { state: 'no_button' | 'no_zone' | 'bad_zone' };

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
  showSound(view: SoundView): boolean;
  hideSound(): void;
  dislike(on: boolean): Promise<Taste>;
  superlike(on: boolean): Taste;
  together(ask: TogetherAsk): Promise<TogetherDone>;
  openRooms(): Promise<OpenRoomShown[] | null>;
  buttons(): Record<ButtonPlace, PlacementMap>;
  placeButton(ask: ButtonAsk): ButtonDone;
  playStation(station: Station): Promise<boolean>;
}
