import { useEffect, useState } from 'react';
import { canUndo, onUndoChange } from '../../../lib/voice/executor';

export function useUndoable(id: string, wanted: boolean): boolean {
  const [ok, setOk] = useState(() => wanted && canUndo(id));
  useEffect(() => {
    if (!wanted) return;
    setOk(canUndo(id));
    return onUndoChange(() => setOk(canUndo(id)));
  }, [id, wanted]);
  return wanted && ok;
}
