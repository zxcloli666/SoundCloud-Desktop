export const PREVIEW_KEYFRAMES = `
@keyframes chat-preview-fly {
  0%, 8%   { transform: translate3d(var(--from-x), 46px, 0) rotate(var(--tilt)) scale(0.86); opacity: 0; }
  22%      { opacity: 1; }
  48%, 86% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); opacity: 1; }
  100%     { transform: translate3d(0, 0, 0) scale(1); opacity: 0; }
}
@keyframes chat-preview-bubble {
  0%, 30%  { transform: scale(0.92); opacity: 0; }
  46%, 86% { transform: scale(1); opacity: 1; }
  100%     { transform: scale(1); opacity: 0; }
}
@keyframes chat-preview-ring {
  from { stroke-dashoffset: var(--ring-full); }
  to   { stroke-dashoffset: var(--ring-to); }
}
[data-preview-still] [data-preview-anim] { animation: none !important; opacity: 1 !important; transform: none !important; }
@media (prefers-reduced-motion: reduce) {
  [data-preview-anim] { animation: none !important; opacity: 1 !important; transform: none !important; }
}
`;
