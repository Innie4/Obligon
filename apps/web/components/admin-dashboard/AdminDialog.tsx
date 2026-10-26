"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogFocus } from "@/components/shared/useDialogFocus";
import { useStatusPopupHost } from "@/components/shared/StatusPopup";

/** Admin records stay in their list; details open in a focused, dismissible review. */
export function AdminDialog({ open, title, description, onClose, children, wide = false }: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  const dialogRef = React.useRef<HTMLElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  React.useEffect(() => setMounted(true), []);
  useDialogFocus(dialogRef, onClose, open && mounted);
  useStatusPopupHost(dialogRef, open && mounted);
  React.useEffect(() => {
    // Disabling a focused action can blur to body without emitting focusin.
    // Keep keyboard context in this review while its request settles.
    if (open && dialogRef.current && document.activeElement === document.body) dialogRef.current.focus();
  });
  if (!open || !mounted) return null;

  return createPortal(
    <div className="admin-workspace admin-dialog-backdrop" data-admin-dialog-backdrop onClick={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined} tabIndex={-1}
        className={`admin-dialog ${wide ? "admin-dialog-wide" : ""}`}>
        <header className="admin-dialog-heading">
          <div className="min-w-0">
            <p className="admin-dialog-eyebrow">Record review</p>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId} className="mt-2 text-sm leading-6 text-obligon-text">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="admin-icon-button shrink-0" aria-label="Close review"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="admin-dialog-content">{children}</div>
      </section>
    </div>, document.body,
  );
}
