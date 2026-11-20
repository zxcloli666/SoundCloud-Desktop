import type { ComponentType } from 'react';
import { DeepMark } from './DeepMark';
import { GemMark } from './GemMark';
import { HeartMark } from './HeartMark';
import { LoliMark } from './LoliMark';
import type { MarkProps } from './mark';

export const MARKS: Record<string, ComponentType<MarkProps>> = {
  loli: LoliMark,
  moriarty: DeepMark,
  af_heart: HeartMark,
  am_michael: GemMark,
};
