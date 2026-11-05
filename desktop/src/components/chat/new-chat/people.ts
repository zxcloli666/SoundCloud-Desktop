import type { UserRef } from '../../../lib/chat/types';
import type { SCUser } from '../../../lib/hooks';

export function userRef(user: SCUser): UserRef {
  return {
    id: String(user.id),
    name: user.username,
    avatarUrl: user.avatar_url ?? null,
    permalink: user.permalink_url ?? null,
  };
}
