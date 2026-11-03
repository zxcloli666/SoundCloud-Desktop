import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {RefreshCw} from '../../../lib/icons';
import {usePremium} from '../../../lib/premium-cache';
import {useImportSyncStore} from '../../../stores/import-sync';
import {ImportSourceIcon} from '../../import/ImportSourceIcon';
import {ImportSyncStatus} from '../../import/ImportSyncStatus';
import {Card, LockedToggle, Row, Toggle} from '../primitives';

export function ImportSyncCard() {
    const {t} = useTranslation();
    const premium = usePremium();
    const entries = useImportSyncStore((s) => s.entries);
    const resume = useImportSyncStore((s) => s.resume);
    const disable = useImportSyncStore((s) => s.disable);
    const acknowledge = useImportSyncStore((s) => s.acknowledge);

    useEffect(() => acknowledge, [acknowledge]);

    return (
        <Card title={t('importer.sync.title')} icon={<RefreshCw size={17}/>}>
            {entries.length === 0 && (
                <p className="text-[12px] text-ink-45">{t('importer.sync.empty')}</p>
            )}
            {entries.map((entry) => (
                <Row
                    key={entry.id}
                    title={
                        <>
                            <ImportSourceIcon kind={entry.kind} size={14}/>
                            <span className="truncate">{entry.title}</span>
                        </>
                    }
                    desc={<ImportSyncStatus entry={entry}/>}
                >
                    {premium || entry.enabled ? (
                        <Toggle
                            checked={entry.enabled}
                            label={entry.title}
                            onChange={() => (entry.enabled ? disable(entry.id) : resume(entry.id))}
                        />
                    ) : (
                        <LockedToggle/>
                    )}
                </Row>
            ))}
        </Card>
    );
}
