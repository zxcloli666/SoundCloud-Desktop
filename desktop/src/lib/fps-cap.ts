//! Кап частоты кадров.
//!
//! В windowed-вебвью (и wry/webkitgtk, и CEF/chromium) анимации идут с частотой
//! развёртки монитора — на 120/144 Гц это лишние CPU/GPU на ту же картинку.
//! Chromium-флага «cap до N fps» для windowed нет (`windowless_frame_rate` —
//! только off-screen). Поэтому троттлим `requestAnimationFrame`: пропущенные
//! кадры переназначаем (чтобы rAF-циклы не рвались), `cancelAnimationFrame`
//! сохраняем рабочим. На дисплеях ≤ целевого FPS — фактически no-op.
//!
//! Решение о пропуске кадра — ОДНО на кадр, и разрешённый кадр забирает ВСЕХ
//! ожидающих разом. Иначе получается голодание: раньше у каждого колбэка была
//! своя проверка против общего `last`, первый отработавший двигал `last` на
//! `now`, и все остальные в том же кадре видели дельту 0 и откладывались. Пока
//! в приложении крутится хоть один постоянный rAF-цикл, он двигает `last`
//! каждый кадр — и отложенные не выполняются НИКОГДА. Так молча умирал переход
//! `data-state` у модалки: она монтировалась и оставалась на `opacity: 0`,
//! то есть «модалки нет» при живом DOM.

const DEFAULT_FPS = 60;

let installed = false;

export function installFpsCap(targetFps: number = DEFAULT_FPS): void {
  if (installed || targetFps <= 0 || typeof window === 'undefined') return;
  installed = true;

  const minDelta = 1000 / targetFps;
  const rafNative = window.requestAnimationFrame.bind(window);
  const cafNative = window.cancelAnimationFrame.bind(window);

  /** Наш handle → колбэк, ожидающий ближайшего разрешённого кадра. */
  const pending = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;
  let nativeId: number | null = null;
  let last = 0;
  let suspended = document.visibilityState === 'hidden';

  function schedule(): void {
    if (!suspended && nativeId === null) nativeId = rafNative(pump);
  }

  function pump(now: number): void {
    nativeId = null;
    if (suspended) return;
    if (now - last < minDelta - 1) {
      schedule(); // кадр пропускаем целиком — вместе со всеми, без исключений
      return;
    }
    last = now;
    // Снимок: колбэк вправе тут же заказать следующий кадр, и он должен попасть
    // в СЛЕДУЮЩУЮ пачку, а не быть съеденным текущей итерацией.
    const batch = Array.from(pending.values());
    pending.clear();
    for (const cb of batch) cb(now);
  }

  window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const handle = nextHandle++;
    pending.set(handle, cb);
    schedule();
    return handle;
  };

  window.cancelAnimationFrame = (handle: number): void => {
    // id не из нашего пула (например, выдан до установки капа) — в нативный.
    if (!pending.delete(handle)) cafNative(handle);
  };

  document.addEventListener('visibilitychange', () => {
    suspended = document.visibilityState === 'hidden';
    if (suspended) {
      if (nativeId !== null) cafNative(nativeId);
      nativeId = null;
      return;
    }
    last = 0;
    if (pending.size > 0) schedule();
  });
}
