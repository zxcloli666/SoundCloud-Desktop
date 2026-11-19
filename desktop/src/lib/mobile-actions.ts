import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import { mobileLink } from '../stores/mobile-link';
import { ApiError, apiRequest } from './api-client';
import { fetchMobileAccess, MOBILE_ACCESS_KEY, type MobileAccess } from './mobile-link/api';
import { queryClient } from './query-client';

const TOAST_ID = 'mobile-actions-link';
const ACCESS_STALE_MS = 60_000;

type LinkNeed = 'link' | 'relink';

const accessQuery = {
  queryKey: MOBILE_ACCESS_KEY,
  queryFn: fetchMobileAccess,
  staleTime: ACCESS_STALE_MS,
  retry: false,
} as const;

export function useMobileAccess(): MobileAccess | null | undefined {
  return useQuery(accessQuery).data;
}

export function useMobileButtons(): boolean {
  return useMobileAccess()?.available === true;
}

export function useMobileReads(): boolean {
  const access = useMobileAccess();
  return access?.available === true && access.linked && access.status === 'active';
}

function askToLink(need: LinkNeed) {
  const relink = need === 'relink';
  toast(i18n.t(relink ? 'mobileActions.relinkNeeded' : 'mobileActions.linkNeeded'), {
    id: TOAST_ID,
    action: {
      label: i18n.t(relink ? 'mobileActions.relink' : 'mobileActions.link'),
      onClick: () => mobileLink.openDialog(),
    },
  });
}

async function knownNeed(): Promise<LinkNeed | null> {
  const access = await queryClient.ensureQueryData(accessQuery).catch(() => null);
  if (!access) return null;
  if (!access.linked) return 'link';
  return access.status === 'relink_required' ? 'relink' : null;
}

export async function guardLink(): Promise<boolean> {
  const need = await knownNeed();
  if (need) askToLink(need);
  return need === null;
}

export function noteReadRefusal(error: ApiError) {
  if (error.code === 'mobile_relink_required') {
    void queryClient.invalidateQueries({ queryKey: MOBILE_ACCESS_KEY });
  }
}

export async function mobileWrite(method: 'PUT' | 'DELETE', path: string): Promise<boolean> {
  try {
    await apiRequest(path, { method });
    return true;
  } catch (error) {
    if (!(error instanceof ApiError)) return false;
    if (error.code === 'mobile_not_linked') askToLink('link');
    if (error.code === 'mobile_relink_required') {
      noteReadRefusal(error);
      askToLink('relink');
    }
    return false;
  }
}
