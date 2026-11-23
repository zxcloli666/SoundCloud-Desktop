export function pressPlayerButton(marker: string) {
  const button = document.querySelector<HTMLElement>(`[data-ui="${marker}"]`);
  if (button && button.getClientRects().length > 0) button.click();
}
