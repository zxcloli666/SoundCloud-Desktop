export const PERK_KEYFRAMES = `
@keyframes perk-seat-in {
  from { transform: scaleY(0.25); opacity: 0; }
  to   { transform: scaleY(1); opacity: 1; }
}
@keyframes perk-seat-wave {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 1; }
}
@keyframes perk-tile-in {
  from { transform: translate3d(0,6px,0) scale(0.96); opacity: 0; }
  to   { transform: translate3d(0,0,0) scale(1); opacity: 1; }
}
@keyframes perk-shimmer {
  from { transform: translate3d(-100%,0,0); }
  to   { transform: translate3d(100%,0,0); }
}
@media (prefers-reduced-motion: reduce) {
  .perk-motion { animation: none !important; transition: none !important; }
}
`;
