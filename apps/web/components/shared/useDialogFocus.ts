"use client";

import { useEffect, useRef, type RefObject } from "react";

const dialogs: HTMLElement[] = [];
let originalOverflow = "";
const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keep keyboard focus in the topmost open dialog and return it to its opener. */
export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  open = true
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogs.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogs.push(dialog);
    if (!dialog.contains(document.activeElement)) dialog.focus();

    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => element.tabIndex >= 0 && !element.closest('[inert], [hidden], [aria-hidden="true"]') && element.getClientRects().length > 0);

    function keydown(event: KeyboardEvent) {
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!first || !last) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || active === dialog || !dialog.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    function containFocus(event: FocusEvent) {
      if (dialogs[dialogs.length - 1] === dialog && event.target instanceof Node && !dialog.contains(event.target)) dialog.focus();
    }
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", containFocus);
      const index = dialogs.lastIndexOf(dialog);
      const wasTopmost = index === dialogs.length - 1;
      if (index !== -1) dialogs.splice(index, 1);
      if (!dialogs.length) document.body.style.overflow = originalOverflow;
      if (wasTopmost) {
        if (opener?.isConnected && !opener.closest('[inert], [hidden]')) opener.focus();
        else dialogs[dialogs.length - 1]?.focus();
      }
    };
  }, [ref, open]);
}
