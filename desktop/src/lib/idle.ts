const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'focus'] as const;

export function onIdle(idleMs: number, callback: () => void): () => void {
  let timer: number | null = null;
  let lastActivity = Date.now();

  const arm = () => {
    timer = window.setTimeout(() => {
      timer = null;
      callback();
    }, idleMs);
  };

  const onActivity = () => {
    const now = Date.now();
    if (timer !== null && now - lastActivity < 1000) return;
    lastActivity = now;
    if (timer !== null) window.clearTimeout(timer);
    arm();
  };

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, onActivity, { passive: true });
  }
  arm();

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, onActivity);
    }
  };
}
