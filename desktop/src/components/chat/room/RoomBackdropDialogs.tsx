import { memo } from 'react';
import type { RoomView } from '../../../lib/together/types';
import { BackdropDialogs } from '../backdrop/BackdropDialogs';
import { useRoomTarget } from './useRoomTarget';

export const RoomBackdropDialogs = memo(function RoomBackdropDialogs({
  room,
  host,
}: {
  room: RoomView;
  host: boolean;
}) {
  const target = useRoomTarget(room, host);
  return <BackdropDialogs scope={null} target={target} reportable={!host} />;
});
