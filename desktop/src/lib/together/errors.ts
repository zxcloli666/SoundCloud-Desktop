import { ApiError } from '../api';

export function sessionErrorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'together.errors.notFound';
    if (error.status === 409) return 'together.errors.full';
    if (error.status === 401) return 'together.errors.signIn';
    if (error.code === 'room_banned') return 'chat.room.errors.banned';
  }
  return 'together.errors.generic';
}

export function openRoomErrorKey(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) return 'together.errors.closed';
  return sessionErrorKey(error);
}

export const CODE_LENGTH = 6;
const CODE_ALPHABET = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;

export function cleanCode(input: string): string {
  return input.toUpperCase().replace(CODE_ALPHABET, '').slice(0, CODE_LENGTH);
}
