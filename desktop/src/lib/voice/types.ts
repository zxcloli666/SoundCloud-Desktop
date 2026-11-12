export type VoiceLanguage = 'ru' | 'en';
export type HeadsetGesture = 'off' | 'double' | 'triple';
export type ListenMode = 'chosen' | 'where_i_speak' | 'everywhere';
export type SpeakMode = 'with_music' | 'device' | 'where_i_listen';
export type EchoMode = 'auto' | 'on' | 'off';

export interface WakeConfig {
  on: boolean;
  phrase: string;
  sensitivity: number;
}

export interface ActivationConfig {
  hotkey: string | null;
  hold: boolean;
  headset: HeadsetGesture;
  wake: WakeConfig;
}

export interface ListenConfig {
  mode: ListenMode;
  devices: string[];
}

export interface SpeakConfig {
  mode: SpeakMode;
  device: string | null;
  voice: string;
  speed: number;
  pitch: number;
  replies: boolean;
}

export interface VoiceConfig {
  enabled: boolean;
  language: VoiceLanguage;
  activation: ActivationConfig;
  listen: ListenConfig;
  speak: SpeakConfig;
  duck: number;
  echo: EchoMode;
  llm: boolean;
  boosts: { artists: string[] };
}

export interface EngineConfig extends VoiceConfig {
  names: string[];
}

export type EngineState = 'idle' | 'listening' | 'thinking' | 'asking' | 'speaking' | 'error';
export type VoiceSource = 'hotkey' | 'headset' | 'wake' | 'button' | 'hud' | 'typed' | 'remote';
export type StartSource = 'button' | 'hud';

export interface StateEvent {
  state: EngineState;
  source: VoiceSource;
  input?: string;
}

export interface HeardEvent {
  id: string;
  source: VoiceSource;
  heard: string;
}

export interface LevelEvent {
  input: string;
  rms: number;
}

export interface PartialEvent {
  text: string;
}

export type EntityKind = 'track' | 'artist' | 'album' | 'playlist';

export interface Entity {
  kind: EntityKind;
  name: string;
  artist: string;
  popularity: number;
  id: string;
}

export interface Scored {
  entity: Entity;
  score: number;
}

export type Decision =
  | { decision: 'act'; pick: Scored }
  | { decision: 'ask'; first: Scored; second: Scored | null }
  | { decision: 'not_found' };

export type Intent =
  | 'play'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'next'
  | 'previous'
  | 'seek_forward'
  | 'seek_backward'
  | 'seek_to'
  | 'volume_up'
  | 'volume_down'
  | 'volume_set'
  | 'mute'
  | 'unmute'
  | 'like'
  | 'unlike'
  | 'shuffle_on'
  | 'shuffle_off'
  | 'repeat_one'
  | 'repeat_all'
  | 'repeat_off'
  | 'queue_add'
  | 'now_playing'
  | 'play_likes'
  | 'play_wave'
  | 'play_similar'
  | 'undo'
  | 'help'
  | 'none';

export interface VoiceCommand {
  id: string;
  source: VoiceSource;
  heard: string;
  normalized: string;
  intent: Intent;
  kind_hint: EntityKind | null;
  number: number | null;
  decision: Decision | null;
  talk?: boolean;
  chatless?: boolean;
  candidates?: Entity[];
  remote_id?: string;
  group?: string;
  step?: number;
  steps?: number;
}

export type VoiceErrorCode =
  | 'mic_denied'
  | 'mic_busy'
  | 'mic_lost'
  | 'no_models'
  | 'model_corrupt'
  | 'not_star'
  | 'network'
  | 'asr_failed'
  | 'tts_failed'
  | 'engine_missing';

export interface ErrorEvent {
  code: VoiceErrorCode;
  detail?: string;
}

export type ModelState = 'missing' | 'partial' | 'ready' | 'corrupted' | 'downloading';
export type ModelKind = 'vad' | 'asr' | 'tts' | 'wake' | 'g2p' | 'llm' | string;

export interface Model {
  id: string;
  kind: ModelKind;
  language: string;
  size: number;
  state: ModelState;
  done: number;
  total: number;
  license: string;
  optional?: boolean;
  listen?: boolean;
}

export interface ModelProgress {
  id: string;
  state: ModelState;
  done: number;
  total: number;
}

export type Transport = 'builtin' | 'usb' | 'bluetooth' | 'hdmi' | 'virtual' | 'unknown';

export interface Device {
  id: string;
  name: string;
  transport: Transport;
  default: boolean;
}

export interface Devices {
  inputs: Device[];
  outputs: Device[];
}

export interface WakeEvent {
  phrase: string;
  score: number;
}

export interface Outcome {
  ok: boolean;
  speech: string;
  display: string;
  undo: boolean;
}

export interface Status {
  state: EngineState;
  star: boolean;
  models: { ready: number; total: number };
  devices: Devices;
  error: ErrorEvent | null;
}

export type WakeTeachStep = 'start' | 'sample' | 'finish' | 'reset';
