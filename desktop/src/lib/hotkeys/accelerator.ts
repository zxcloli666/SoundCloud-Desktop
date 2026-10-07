export type Modifier = 'Control' | 'Alt' | 'Shift' | 'Super';

export interface KeyChord {
  modifiers: Modifier[];
  code: string | null;
}

export type ChordProblem = 'needsModifier' | 'mediaKey' | 'unsupported' | 'reserved';

const MODIFIER_ORDER: Modifier[] = ['Control', 'Alt', 'Shift', 'Super'];

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
]);

const MEDIA_CODES = new Set([
  'MediaPlayPause',
  'MediaPlay',
  'MediaPause',
  'MediaStop',
  'MediaTrackNext',
  'MediaTrackPrevious',
  'AudioVolumeUp',
  'AudioVolumeDown',
  'AudioVolumeMute',
]);

const NAMED_CODES = new Set([
  'Space',
  'Enter',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Backquote',
  'Minus',
  'Equal',
  'BracketLeft',
  'BracketRight',
  'Backslash',
  'Semicolon',
  'Quote',
  'Comma',
  'Period',
  'Slash',
  'Pause',
  'ScrollLock',
  'PrintScreen',
  'NumpadAdd',
  'NumpadSubtract',
  'NumpadMultiply',
  'NumpadDivide',
  'NumpadDecimal',
  'NumpadEnter',
]);

const ZOOM_CODES = ['Equal', 'Minus', 'Digit0', 'NumpadAdd', 'NumpadSubtract', 'Numpad0'];
const ZOOM_MODIFIERS = ['Control', 'Control+Shift', 'Super', 'Shift+Super'];

const RESERVED = new Set([
  'Control+KeyK',
  'Control+Slash',
  'Super+KeyK',
  'Super+Slash',
  ...ZOOM_MODIFIERS.flatMap((modifiers) => ZOOM_CODES.map((code) => `${modifiers}+${code}`)),
]);

const KEY_LABELS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: '⌫',
  Delete: 'Del',
  Insert: 'Ins',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Pause: 'Pause',
  ScrollLock: 'ScrLk',
  PrintScreen: 'PrtSc',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .',
  NumpadEnter: 'Num Enter',
};

export function isModifierCode(code: string): boolean {
  return MODIFIER_CODES.has(code);
}

export function isSupportedCode(code: string): boolean {
  return (
    /^Key[A-Z]$/.test(code) ||
    /^Digit[0-9]$/.test(code) ||
    /^Numpad[0-9]$/.test(code) ||
    /^F([1-9]|1[0-9]|2[0-4])$/.test(code) ||
    NAMED_CODES.has(code)
  );
}

function isExtendedFunctionKey(code: string): boolean {
  return /^F(1[3-9]|2[0-4])$/.test(code);
}

export function chordFromEvent(event: KeyboardEvent): KeyChord {
  const modifiers: Modifier[] = [];
  if (event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.metaKey) modifiers.push('Super');
  return { modifiers, code: isModifierCode(event.code) ? null : event.code };
}

export function toAccelerator(chord: KeyChord): string {
  if (!chord.code) return '';
  const modifiers = MODIFIER_ORDER.filter((m) => chord.modifiers.includes(m));
  return [...modifiers, chord.code].join('+');
}

export function parseAccelerator(accelerator: string): KeyChord {
  const parts = accelerator.split('+').filter(Boolean);
  const code = parts.pop() ?? null;
  const modifiers = MODIFIER_ORDER.filter((m) => parts.includes(m));
  return { modifiers, code };
}

export function chordProblem(chord: KeyChord): ChordProblem | null {
  if (!chord.code) return null;
  if (MEDIA_CODES.has(chord.code)) return 'mediaKey';
  if (!isSupportedCode(chord.code)) return 'unsupported';
  if (RESERVED.has(toAccelerator(chord))) return 'reserved';
  const strongModifier = chord.modifiers.some((m) => m !== 'Shift');
  if (!strongModifier && !isExtendedFunctionKey(chord.code)) return 'needsModifier';
  return null;
}

export function modifierLabel(modifier: Modifier, mac: boolean, windows: boolean): string {
  if (mac) {
    return { Control: '⌃', Alt: '⌥', Shift: '⇧', Super: '⌘' }[modifier];
  }
  if (modifier === 'Control') return 'Ctrl';
  if (modifier === 'Super') return windows ? 'Win' : 'Super';
  return modifier;
}

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
  return KEY_LABELS[code] ?? code;
}

export function chordLabels(chord: KeyChord, mac: boolean, windows: boolean): string[] {
  const labels = MODIFIER_ORDER.filter((m) => chord.modifiers.includes(m)).map((m) =>
    modifierLabel(m, mac, windows),
  );
  if (chord.code) labels.push(keyLabel(chord.code));
  return labels;
}
