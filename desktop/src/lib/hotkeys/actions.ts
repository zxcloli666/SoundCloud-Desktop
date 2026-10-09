export const GLOBAL_HOTKEY_ACTIONS = [
  'playPause',
  'next',
  'prev',
  'volumeUp',
  'volumeDown',
  'mute',
  'like',
  'seekForward',
  'seekBack',
] as const;

export type GlobalHotkeyAction = (typeof GLOBAL_HOTKEY_ACTIONS)[number];

export type GlobalHotkeyMap = Record<GlobalHotkeyAction, string>;

export const DEFAULT_GLOBAL_HOTKEYS: GlobalHotkeyMap = {
  playPause: 'Control+Alt+Space',
  next: 'Control+Alt+ArrowRight',
  prev: 'Control+Alt+ArrowLeft',
  volumeUp: 'Control+Alt+ArrowUp',
  volumeDown: 'Control+Alt+ArrowDown',
  mute: '',
  like: '',
  seekForward: '',
  seekBack: '',
};

export const GLOBAL_VOLUME_STEP = 5;
export const GLOBAL_SEEK_STEP_SECONDS = 10;

export function withDefaults(map: Partial<GlobalHotkeyMap> | undefined): GlobalHotkeyMap {
  return { ...DEFAULT_GLOBAL_HOTKEYS, ...map };
}
