import type { UserRef } from '../../../lib/chat/types';
import { labAvatar } from './pictures';

export const ME_ID = 'u-me';

const NAMES: Record<string, string> = {
  [ME_ID]: 'Лёша',
  'u-mira': 'Mira',
  'u-danil': 'Данил',
  'u-sasha': 'Саша Orbit',
  'u-kai': 'Kai',
  'u-lena': 'Лена',
  'u-tim': 'Tim Bass',
};

export function person(id: string): UserRef {
  const name = NAMES[id] ?? id;
  return { id, name, avatarUrl: labAvatar(name), permalink: `https://soundcloud.com/${id}` };
}

export function personName(id: string): string {
  return NAMES[id] ?? id;
}
