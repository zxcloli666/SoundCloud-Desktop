export interface Turn {
  id: string;
  heard: string;
  answered: boolean;
}

interface Left {
  id: string;
  heard: string;
  at: number;
}

export function unansweredTurns(keepMs: number) {
  let left: Left[] = [];

  return {
    leave(turn: Turn, at: number) {
      if (turn.answered || left.some((kept) => kept.id === turn.id)) return;
      left = [...left, { id: turn.id, heard: turn.heard, at }];
    },
    text(id: string, heard: string, now: number, pending: Turn | null): string {
      const recent = left.filter((kept) => kept.id !== id && now - kept.at <= keepMs);
      const open =
        pending &&
        pending.id !== id &&
        !pending.answered &&
        !recent.some((kept) => kept.id === pending.id)
          ? [pending]
          : [];
      return [...recent, ...open, { heard }].map((turn) => turn.heard).join('\n');
    },
    clear() {
      left = [];
    },
  };
}
