export type Step =
  | { kind: 'run'; run: () => void | Promise<void> }
  | { kind: 'click'; selector: string }
  | { kind: 'wait-for'; selector: string }
  | { kind: 'wait'; ms: number };

const WAIT_STEP_MS = 6000;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitUntil(test: () => boolean, timeoutMs = WAIT_STEP_MS): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (test()) return true;
    await sleep(50);
  }
  return test();
}

function press(element: Element) {
  const init = { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' };
  element.dispatchEvent(new PointerEvent('pointerdown', init));
  element.dispatchEvent(new MouseEvent('mousedown', init));
  element.dispatchEvent(new PointerEvent('pointerup', init));
  element.dispatchEvent(new MouseEvent('mouseup', init));
  element.dispatchEvent(new MouseEvent('click', init));
}

export async function runStep(step: Step) {
  if (step.kind === 'run') {
    await step.run();
  } else if (step.kind === 'wait') {
    await sleep(step.ms);
  } else if (step.kind === 'wait-for') {
    const found = await waitUntil(() => document.querySelector(step.selector) !== null);
    if (!found) throw new Error(`lab: ${step.selector} did not appear`);
  } else {
    const found = await waitUntil(() => document.querySelector(step.selector) !== null);
    const element = document.querySelector(step.selector);
    if (!found || !element) throw new Error(`lab: ${step.selector} did not appear`);
    press(element);
    await sleep(250);
  }
}
