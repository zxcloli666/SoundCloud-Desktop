import type { Address, ListenerConfig, RelationConfig, RelationRole } from './types';

const USUAL: Record<RelationRole, Address | null> = {
  friend: 'informal',
  mentor: 'informal',
  assistant: 'formal',
  butler: 'formal',
  own: null,
};

export function roleAddress(role: RelationRole | null): Address | null {
  return role ? USUAL[role] : null;
}

export function addressOf(listener: ListenerConfig, relation: RelationConfig): Address | null {
  return listener.address ?? roleAddress(relation.role);
}
