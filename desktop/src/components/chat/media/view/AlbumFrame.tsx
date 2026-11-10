import { memo, type ReactNode } from 'react';
import { type AlbumBox, tileStyle } from './album-layout';

export type TileStyle = ReturnType<typeof tileStyle>;

export const AlbumFrame = memo(function AlbumFrame({
  box,
  children,
  overlay,
}: {
  box: AlbumBox;
  children: (index: number, style: TileStyle) => ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <div
      data-ui="chat-album"
      className="relative -mx-[9px] overflow-hidden rounded-[13px]"
      style={{
        width: box.width,
        maxWidth: 'calc(100% + 18px)',
        aspectRatio: `${box.width} / ${box.height}`,
      }}
    >
      {box.tiles.map((tile, index) => children(index, tileStyle(box, tile)))}
      {overlay}
    </div>
  );
});
