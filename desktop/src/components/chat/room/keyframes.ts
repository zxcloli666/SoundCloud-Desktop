export const ROOM_KEYFRAMES = `
@keyframes room-fade {
  from { opacity: 0; }
  to   { opacity: 0.5; }
}
@keyframes room-drop {
  from { transform: translate3d(0,-10px,0) scale(0.96); opacity: 0; }
  to   { transform: translate3d(0,0,0) scale(1); opacity: 1; }
}
@keyframes room-rise {
  from { transform: translate3d(0,10px,0) scale(0.9); opacity: 0; }
  to   { transform: translate3d(0,0,0) scale(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .chat-motion { animation: none !important; }
}
`;
