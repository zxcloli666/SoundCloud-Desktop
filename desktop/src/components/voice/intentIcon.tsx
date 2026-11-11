import type { ReactNode } from 'react';
import {
  Compass,
  Disc3,
  FastForward,
  Heart,
  Info,
  ListMusic,
  ListPlus,
  ListX,
  MessageCircle,
  MicVocal,
  Music,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Rewind,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from '../../lib/icons';
import type { ToolMark } from '../../lib/voice/chat/types';
import type { DoneItem } from '../../lib/voice/runtime';
import type { EntityKind, Intent } from '../../lib/voice/types';
import { AudioWaveform, Brain, Eraser, Gauge, Undo2 } from './icons';

export function kindIcon(kind: EntityKind, size: number): ReactNode {
  if (kind === 'artist') return <User size={size} />;
  if (kind === 'album') return <Disc3 size={size} />;
  if (kind === 'playlist') return <ListMusic size={size} />;
  return <Music size={size} />;
}

const INTENT_ICONS: Partial<Record<Intent, (size: number) => ReactNode>> = {
  pause: (s) => <Pause size={s} />,
  stop: (s) => <Pause size={s} />,
  resume: (s) => <Play size={s} />,
  next: (s) => <SkipForward size={s} />,
  previous: (s) => <SkipBack size={s} />,
  seek_forward: (s) => <FastForward size={s} />,
  seek_backward: (s) => <Rewind size={s} />,
  seek_to: (s) => <FastForward size={s} />,
  volume_up: (s) => <Volume2 size={s} />,
  volume_down: (s) => <Volume2 size={s} />,
  volume_set: (s) => <Volume2 size={s} />,
  mute: (s) => <VolumeX size={s} />,
  unmute: (s) => <Volume2 size={s} />,
  like: (s) => <Heart size={s} fill="currentColor" />,
  unlike: (s) => <Heart size={s} />,
  shuffle_on: (s) => <Shuffle size={s} />,
  shuffle_off: (s) => <Shuffle size={s} />,
  repeat_one: (s) => <Repeat1 size={s} />,
  repeat_all: (s) => <Repeat size={s} />,
  repeat_off: (s) => <Repeat size={s} />,
  queue_add: (s) => <ListPlus size={s} />,
  now_playing: (s) => <AudioWaveform size={s} />,
  play_likes: (s) => <Heart size={s} fill="currentColor" />,
  play_wave: (s) => <Radio size={s} />,
  play_similar: (s) => <Sparkles size={s} />,
  undo: (s) => <Undo2 size={s} />,
  help: (s) => <Info size={s} />,
  none: (s) => <MessageCircle size={s} />,
};

export function intentIcon(intent: Intent, size: number): ReactNode {
  return INTENT_ICONS[intent]?.(size) ?? <Play size={size} />;
}

export function itemIcon(item: DoneItem, size: number): ReactNode {
  if (item.entity && (item.intent === 'play' || item.intent === 'queue_add')) {
    return kindIcon(item.entity.kind, size);
  }
  return intentIcon(item.intent, size);
}

const TOOL_ICONS: Record<string, (size: number) => ReactNode> = {
  speed: (s) => <Gauge size={s} />,
  search: (s) => <Search size={s} />,
  open_page: (s) => <Compass size={s} />,
  get_settings: (s) => <Settings size={s} />,
  set_setting: (s) => <Settings size={s} />,
  lyrics: (s) => <MicVocal size={s} />,
  queue_list: (s) => <ListMusic size={s} />,
  queue_clear: (s) => <ListX size={s} />,
  add_to_playlist: (s) => <ListPlus size={s} />,
  remember: (s) => <Brain size={s} />,
  forget: (s) => <Eraser size={s} />,
};

export function markIcon(mark: ToolMark, size: number): ReactNode {
  if (mark.kind) return kindIcon(mark.kind, size);
  if (mark.intent) return intentIcon(mark.intent, size);
  return TOOL_ICONS[mark.tool]?.(size) ?? <Play size={size} />;
}
