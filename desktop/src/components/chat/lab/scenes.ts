import type { LabScene } from './types';

const modules = import.meta.glob<{ scenes: LabScene[] }>('./scenes/*.tsx', { eager: true });

export const labScenes: LabScene[] = Object.values(modules).flatMap((module) => module.scenes);
