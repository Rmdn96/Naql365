'use client';
import { useRef, type ReactNode } from 'react';

export function MobileMenu({
  label,
  close,
  children,
}: {
  label: string;
  close: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="mobile-menu">
      <button
        ref={trigger}
        type="button"
        className="button button--secondary"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      <dialog ref={dialog} aria-label={label} onClose={() => trigger.current?.focus()}>
        <form method="dialog">
          <button className="button button--secondary">{close}</button>
        </form>
        <div
          className="mobile-menu-links"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) dialog.current?.close();
          }}
        >
          {children}
        </div>
      </dialog>
    </div>
  );
}
