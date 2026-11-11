import type { ComponentType } from 'react';
import { DeepMark } from './DeepMark';
import { GemMark } from './GemMark';
import { HeartMark } from './HeartMark';
import { LolyaMark } from './LolyaMark';
import type { MarkProps } from './mark';

export const MARKS: Record<string, ComponentType<MarkProps>> = {
  lolya: LolyaMark,
  moriarty: DeepMark,
  af_heart: HeartMark,
  am_michael: GemMark,
};
