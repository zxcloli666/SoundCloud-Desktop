import { useTranslation } from 'react-i18next';
import { type SyncStatus, useSyncStatus } from '../../lib/sync-status';
import { Row } from '../settings/primitives';
import { SyncStatusBadge } from './SyncStatusChip';
import { useSyncCopy } from './useSyncCopy';

function SyncRow({ status }: { status: SyncStatus }) {
  const { t } = useTranslation();
  const { hint } = useSyncCopy(status);
  return (
    <div className="mb-4 border-b border-white/[0.05] pb-4">
      <Row title={t('sync.title')} desc={hint}>
        <SyncStatusBadge status={status} />
      </Row>
    </div>
  );
}

export function SyncStatusRow() {
  const { data } = useSyncStatus();
  if (!data) return null;
  return <SyncRow status={data} />;
}
