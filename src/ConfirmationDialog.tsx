import { useEffect, useRef } from "react";

export function ConfirmationDialog({ message, confirmLabel, cancelLabel, onResolve }: {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onResolve: (confirmed: boolean) => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onResolve(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [message, onResolve]);

  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onResolve(false);
    }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-describedby="confirm-message">
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button ref={cancelButtonRef} type="button" className="secondary" onClick={() => onResolve(false)}>{cancelLabel}</button>
          <button type="button" className="confirm-destructive" onClick={() => onResolve(true)}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}