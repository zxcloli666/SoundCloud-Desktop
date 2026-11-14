import { create } from 'zustand';
import type { ToolMark } from './types';

interface ChatLive {
  parts: string[];
  marks: ToolMark[];
}

export const useChatLive = create<ChatLive>(() => ({ parts: [], marks: [] }));

export function openReply() {
  useChatLive.setState({ parts: [], marks: [] });
}

export function appendSay(delta: string) {
  if (delta) useChatLive.setState((s) => ({ parts: [...s.parts, delta] }));
}

export function addMark(mark: ToolMark) {
  useChatLive.setState((s) => ({ marks: [...s.marks, mark] }));
}

export function replyLength(): number {
  return useChatLive.getState().parts.reduce((n, part) => n + part.length, 0);
}
