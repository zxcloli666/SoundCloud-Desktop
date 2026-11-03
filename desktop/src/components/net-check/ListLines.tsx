import React from 'react';
import type { ExcludeList } from '../../lib/net/dpi';
import { CopyLine } from './CopyLine';

export const CAPTION = 'mb-1 px-1 text-[10.5px] text-ink-30';

export const ListLines = React.memo(({ list }: { list: ExcludeList }) => (
  <div>
    {list.file && (
      <div className={`${CAPTION} font-mono truncate`} title={list.file}>
        {list.file}
      </div>
    )}
    <CopyLine text={list.lines.join('\n')} />
  </div>
));
