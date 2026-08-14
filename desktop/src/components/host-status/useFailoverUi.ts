import { useShallow } from 'zustand/shallow';
import { type FailoverUi, selectFailoverUi, useHostStatusStore } from '../../lib/host-status';
import { useAppStatusStore } from '../../stores/app-status';

export function useFailoverUi(): FailoverUi {
  const verdicts = useHostStatusStore(
    useShallow((state) => ({ main: state.main, net: state.net })),
  );
  const navigatorOnline = useAppStatusStore((state) => state.navigatorOnline);
  const offlineBypass = useAppStatusStore((state) => state.offlineBypass);
  return selectFailoverUi(verdicts, navigatorOnline, offlineBypass);
}
