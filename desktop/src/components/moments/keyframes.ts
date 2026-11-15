export const MOMENTS_KEYFRAMES = `
@keyframes mo-breathe { from { transform: scale(1); } to { transform: scale(1.04); } }
@keyframes mo-eq { from { transform: scaleY(0.25); } to { transform: scaleY(1); } }
@keyframes mo-in-up { from { opacity: 0; transform: translate3d(0, 56px, 0) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes mo-in-down { from { opacity: 0; transform: translate3d(0, -56px, 0) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes mo-fade { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .mo-anim { animation: none !important; }
}
`;
