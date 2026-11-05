import { create } from 'zustand';
import type { ConvId, Seq, UserId } from '../../../lib/chat/types';

export interface ReportTarget {
  conversationId: ConvId;
  seqFrom: Seq;
  seqTo: Seq;
  name: string;
  userId: UserId | null;
}

interface ReportState {
  open: boolean;
  session: number;
  target: ReportTarget | null;
  close: () => void;
}

export const useReportStore = create<ReportState>()((set) => ({
  open: false,
  session: 0,
  target: null,
  close: () => set({ open: false }),
}));

export function openReport(target: ReportTarget) {
  useReportStore.setState((state) => ({ open: true, target, session: state.session + 1 }));
}
