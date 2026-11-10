import type { ConversationSummary, Member, UserId } from '../../../lib/chat/types';
import type { BackdropAccess } from './target';

function active(conversation: ConversationSummary): boolean {
  return conversation.state === 'active' && conversation.accepted;
}

function staff(conversation: ConversationSummary): boolean {
  return conversation.role === 'owner' || conversation.role === 'admin';
}

export function peerReady(members: Member[], me: UserId | null): boolean | null {
  if (members.length === 0) return null;
  return members.some(
    (member) => member.user.id !== me && member.state === 'active' && member.accepted,
  );
}

export function setsBackdrop(conversation: ConversationSummary): boolean {
  if (!active(conversation)) return false;
  if (conversation.kind === 'direct' || conversation.kind === 'self') return true;
  if (conversation.kind === 'group' || conversation.kind === 'public') return staff(conversation);
  return false;
}

export function backdropAccess(
  conversation: ConversationSummary,
  star: boolean,
  peer: boolean | null,
): BackdropAccess {
  if (!setsBackdrop(conversation)) return 'role';
  if (conversation.kind === 'direct') {
    if (peer === null) return 'loading';
    if (!peer) return 'pending';
  }
  return star ? 'ready' : 'star';
}

export function clearsBackdrop(conversation: ConversationSummary): boolean {
  return conversation.kind === 'public' && setsBackdrop(conversation);
}

export function reportsBackdrop(conversation: ConversationSummary, me: UserId | null): boolean {
  const backdrop = conversation.backdrop;
  return backdrop?.kind === 'image' && backdrop.by !== me;
}
