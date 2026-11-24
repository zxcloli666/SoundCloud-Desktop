let clicked: Element | null = null;

function buttonOf(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest('button, summary, [role="button"]') : null;
}

export function ownsSpace(target: EventTarget | null): boolean {
  const button = buttonOf(target);
  return button !== null && button !== clicked;
}

export function watchClickedButton(): () => void {
  const onPointerDown = (event: PointerEvent) => {
    clicked = buttonOf(event.target);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Tab') clicked = null;
  };
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('keydown', onKeyDown, true);
  return () => {
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('keydown', onKeyDown, true);
  };
}
