import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import "./ConfirmDialog.css";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  children?: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmDialog({
  open,
  title,
  description,
  children,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  busy = false,
  busyLabel = "Processing…",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  const onCancelRef = useRef(onCancel);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  busyRef.current = busy;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocusedRef.current?.isConnected) previouslyFocusedRef.current.focus();
      previouslyFocusedRef.current = null;
    };
  }, [open]);

  function stopDialogKeyPropagation(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") event.stopPropagation();
  }

  if (!open) return null;

  return createPortal(
    <div className="confirm-dialog-overlay">
      <section
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={stopDialogKeyPropagation}
      >
        <div className="confirm-dialog__accent" aria-hidden="true" />
        <div className="confirm-dialog__icon" aria-hidden="true">?</div>
        <p className="confirm-dialog__eyebrow">PLEASE CONFIRM</p>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId} className="confirm-dialog__description">{description}</p>
        {children && <div className="confirm-dialog__content">{children}</div>}
        <div className="confirm-dialog__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="confirm-dialog__cancel"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-dialog__confirm"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <><span className="confirm-dialog__spinner" aria-hidden="true" />{busyLabel}</> : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default ConfirmDialog;
