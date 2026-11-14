import { EQ_PRESETS } from '../../equalizer.ts';

export type SettingValue = string | number | boolean;

type Rule =
  | { kind: 'switch' }
  | { kind: 'choice'; options: readonly string[] }
  | { kind: 'range'; min: number; max: number; step: number };

const SWITCH: Rule = { kind: 'switch' };

function choice(options: readonly string[]): Rule {
  return { kind: 'choice', options };
}

function range(min: number, max: number, step: number): Rule {
  return { kind: 'range', min, max, step };
}

export const SETTING_RULES = {
  theme: choice(['dark', 'white', 'system']),
  performance: choice(['light', 'medium', 'beauty']),
  equalizer: SWITCH,
  equalizer_preset: choice(Object.keys(EQ_PRESETS)),
  normalize_volume: SWITCH,
  skip_silence: SWITCH,
  crossfade: range(0, 12, 1),
  stream_quality: choice(['auto', 'sq', 'hq', 'uq']),
  autoplay: SWITCH,
  wave_mode: choice(['similar', 'diverse']),
  wave_hide_liked: SWITCH,
  wave_hide_listened: SWITCH,
  lyrics_highlight: choice(['word', 'line']),
  lyrics_visualizer: SWITCH,
  floating_comments: SWITCH,
  spoken_replies: SWITCH,
  voice_speed: range(0.8, 1.3, 0.05),
} satisfies Record<string, Rule>;

export type SettingKey = keyof typeof SETTING_RULES;
export const SETTING_KEYS = Object.keys(SETTING_RULES) as SettingKey[];

const ON = new Set(['on', 'true', 'yes', '1']);
const OFF = new Set(['off', 'false', 'no', '0']);

function snap(value: number, rule: Extract<Rule, { kind: 'range' }>): number {
  const clamped = Math.min(rule.max, Math.max(rule.min, value));
  return Math.round(Math.round(clamped / rule.step) * rule.step * 100) / 100;
}

export function parseSetting(key: SettingKey, raw: string): SettingValue | null {
  const rule: Rule = SETTING_RULES[key];
  const text = raw.trim().toLowerCase();
  if (rule.kind === 'switch') {
    if (ON.has(text)) return true;
    return OFF.has(text) ? false : null;
  }
  if (rule.kind === 'choice') {
    return rule.options.find((option) => option.toLowerCase() === text) ?? null;
  }
  const value = Number(text.replace(',', '.'));
  return text !== '' && Number.isFinite(value) ? snap(value, rule) : null;
}

export function allowedValues(key: SettingKey): string {
  const rule: Rule = SETTING_RULES[key];
  if (rule.kind === 'switch') return 'on|off';
  if (rule.kind === 'choice') return rule.options.join('|');
  return `${rule.min}-${rule.max}`;
}

export function settingsHint(): string {
  return SETTING_KEYS.filter((key) => SETTING_RULES[key].kind !== 'switch')
    .map((key) => `${key} ${allowedValues(key)}`)
    .join('; ');
}

export function shownValue(value: SettingValue): string | number {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  return value;
}
