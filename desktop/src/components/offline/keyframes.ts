export const OFFLINE_KEYFRAMES = `
@keyframes off-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes off-flicker { 0%, 100% { opacity: 0.5; } 38% { opacity: 0.85; } 62% { opacity: 0.6; } 80% { opacity: 0.92; } }
@keyframes off-spark {
  0%   { transform: translateY(0) scale(1); opacity: 0; }
  12%  { opacity: 0.9; }
  100% { transform: translateY(-44px) scale(0.4); opacity: 0; }
}
@keyframes off-belt { to { transform: translateX(21px); } }
@keyframes off-sheen { to { transform: translateX(420%); } }
@keyframes off-rowsheen { to { transform: translateX(560%); } }
@media (prefers-reduced-motion: reduce) {
  .off-anim { animation: none !important; }
}
`;
