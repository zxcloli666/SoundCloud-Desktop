import { memo } from 'react';
import { useBinds, useRemoveBind } from '../../../../lib/binds';
import { usePaySubscription } from '../../../../lib/star-offer';
import { useFlowApi } from '../flow/derive';
import { BindItem } from './BindItem';

export const BindList = memo(function BindList() {
  const binds = useBinds().data?.methods ?? [];
  const used = usePaySubscription().data?.renewal?.method ?? null;
  const removeBind = useRemoveBind();
  const api = useFlowApi();
  return (
    <>
      {binds.map((bind) => (
        <BindItem
          key={bind.method}
          bind={bind}
          used={used === bind.method}
          removing={removeBind.isPending && removeBind.variables === bind.method}
          onRemove={() => removeBind.mutate(bind.method)}
          onLink={() => api.startLink(bind.method, bind.flow, false)}
        />
      ))}
    </>
  );
});
