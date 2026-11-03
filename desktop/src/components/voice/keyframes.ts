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
`;
