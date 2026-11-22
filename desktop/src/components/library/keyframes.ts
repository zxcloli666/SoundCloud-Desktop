export const LIBRARY_KEYFRAMES = `
@keyframes sp-rise {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sp-breathe {
  0%, 100% { transform: scaleY(0.93); }
  50%      { transform: scaleY(1); }
}
[data-app-hidden='1'] .sp-breathe { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  .sp-rise, .sp-breathe { animation: none !important; }
  .sp-rise { opacity: 1 !important; transform: none !important; }
  .sp-breathe { transform: none !important; }
}
`;
