import { Fragment, type ReactNode, useCallback, useState } from 'react';
import { HorizontalScroll } from '../../../ui/HorizontalScroll';

const FIRST_BATCH = 60;
const BATCH = 60;
const WHEEL_STEP_CARDS = 6;

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  activeKey?: string;
  onEnd?: () => void;
}

export function ShelfScroll<T>({ items, keyOf, renderItem, activeKey, onEnd }: Props<T>) {
  const [shown, setShown] = useState(FIRST_BATCH);

  const more = useCallback(() => {
    if (shown < items.length) setShown((count) => count + BATCH);
    else onEnd?.();
  }, [shown, items.length, onEnd]);

  return (
    <HorizontalScroll
      className="gap-4 pb-1"
      activeItemKey={activeKey}
      wheelStepItems={WHEEL_STEP_CARDS}
      onNearEnd={more}
    >
      {items.slice(0, shown).map((item) => (
        <Fragment key={keyOf(item)}>{renderItem(item)}</Fragment>
      ))}
    </HorizontalScroll>
  );
}
