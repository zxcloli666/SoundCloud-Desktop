import { useTranslation } from 'react-i18next';
import { type SyncStatus, useSyncStatus } from '../../lib/sync-status';
import { Row } from '../settings/primitives';
import { SyncStatusBadge } from './SyncStatusChip';
import { useSyncCopy } from './useSyncCopy';

function SyncRow({ status }: { status: SyncStatus }) {
  const { t } = useTranslation();
  const { hint, action } = useSyncCopy(status);
  return (
    <Row title={t('sync.title')} desc={hint}>
      <SyncStatusBadge status={status} withAction={false} className="max-w-full" />
      {action && (
        <button type="button" onClick={action.run} disabled={action.disabled} className="set-btn">
          {action.label}
        </button>
      )}
    </Row>
  );
}

export function SyncStatusRow() {
  const { data } = useSyncStatus();
  if (!data) return null;
  return <SyncRow status={data} />;
}
