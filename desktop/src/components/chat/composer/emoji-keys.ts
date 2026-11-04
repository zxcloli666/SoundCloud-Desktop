import { isMac, isWindows } from '../../../lib/platform';

const EMOJI = /\p{Extended_Pictographic}(?:️|⃣|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*/u;

export function emojiKeys(): string[] {
  if (isMac()) return ['⌃', '⌘', 'Space'];
  if (isWindows()) return ['Win', '.'];
  return ['Ctrl', '.'];
}

export function firstEmoji(text: string): string | null {
  return EMOJI.exec(text)?.[0] ?? null;
}
