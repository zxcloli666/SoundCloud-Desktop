import type { ComponentType } from 'react';
import { CalmMark } from './CalmMark';
import { DeepMark } from './DeepMark';
import { GemMark } from './GemMark';
import { HeartMark } from './HeartMark';
import { LolyaMark } from './LolyaMark';
import type { MarkProps } from './mark';
import { RobotMark } from './RobotMark';

export const MARKS: Record<string, ComponentType<MarkProps>> = {
  lolya: LolyaMark,
  calm: CalmMark,
  male: DeepMark,
  robot: RobotMark,
  af_heart: HeartMark,
  am_michael: GemMark,
};
