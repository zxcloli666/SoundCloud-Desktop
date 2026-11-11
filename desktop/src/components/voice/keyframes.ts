export const VOICE_KEYFRAMES = `
@keyframes vx-breathe { 0%, 100% { opacity: 0.32; } 50% { opacity: 0.62; } }
@keyframes vx-spin { to { transform: rotate(360deg); } }
@keyframes vx-ripple { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(1.75); opacity: 0; } }
@keyframes vx-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes vx-dot { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
@keyframes vx-pop { 0% { opacity: 0; transform: translateY(6px) scale(0.97); } 100% { opacity: 1; transform: none; } }
@keyframes vx-countdown { from { stroke-dashoffset: 0; } to { stroke-dashoffset: var(--len); } }
@keyframes vx-flash { 0% { transform: scale(0.6); opacity: 0; } 30% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes vx-bars { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
@keyframes vx-wait { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
@keyframes vx-halo { 0%, 100% { opacity: 0.7; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-1px); } }
@keyframes vx-twinkle { 0%, 100% { opacity: 0.3; transform: scale(0.55); } 50% { opacity: 1; transform: scale(1); } }
@keyframes vx-flap-l { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-12deg); } }
@keyframes vx-flap-r { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(12deg); } }
@keyframes vx-blink { 0%, 91%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.1); } }
@keyframes vx-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes vx-glow { 0%, 100% { opacity: 0.55; transform: scale(0.96); } 50% { opacity: 0.9; transform: scale(1.04); } }
@keyframes vx-ink { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { [style*="vx-"] { animation: none !important; } }
`;
