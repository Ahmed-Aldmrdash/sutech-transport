/**
 * After a submit that failed validation: moves focus to the first control marked invalid, so
 * keyboard and screen reader users land on what needs fixing (the error text is announced
 * with it). Runs on the next frame, once React has rendered the errors.
 */
export function focusFirstError(root: HTMLElement | null): void {
  if (!root) return;
  window.requestAnimationFrame(() => {
    const target = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!target) return;
    target.focus();
    target.scrollIntoView?.({ block: "center" });
  });
}
