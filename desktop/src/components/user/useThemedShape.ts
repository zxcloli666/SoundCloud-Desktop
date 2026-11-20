import { useAuthStore } from '../../stores/auth';
import { THEMED_OWNER_SHAPE, THEMED_SHAPE } from '../music/columns/TrackColumns';

export function useThemedShape(ownerUrn?: string) {
  const owner = useAuthStore((s) => !!ownerUrn && s.user?.urn === ownerUrn);
  return owner ? THEMED_OWNER_SHAPE : THEMED_SHAPE;
}
