import { useEffect, useRef, type ReactNode } from "react";

export function ConfirmationDialog({ message, detail, confirmLabel, cancelLabel, onResolve, backdropClassName }: {
  message: string;
  detail?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onResolve: (confirmed: boolean) => void;
  backdropClassName?: string;
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
    <div className={`modal-backdrop confirm-backdrop${backdropClassName ? ` ${backdropClassName}` : ""}`}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-describedby="confirm-message">
        <p id="confirm-message">{message}</p>
        {detail}
        <div className="confirm-actions">
          <button ref={cancelButtonRef} type="button" className="secondary" data-controller-back="" onClick={() => onResolve(false)}>{cancelLabel}</button>
          <button type="button" className="confirm-destructive" onClick={() => onResolve(true)}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}