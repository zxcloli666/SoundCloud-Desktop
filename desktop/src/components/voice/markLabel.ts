import type { TFunction } from 'i18next';
import type { ToolMark } from '../../lib/voice/chat/types';

export function markLabel(mark: ToolMark, t: TFunction): string {
  return mark.text || t(`voice.chat.tools.${mark.tool}`, { defaultValue: mark.tool });
}
