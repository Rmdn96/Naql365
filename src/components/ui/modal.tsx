'use client';
import { useRef, useId } from 'react';
import { Button } from './primitives';
export function Modal({
  trigger,
  title,
  body,
  close,
}: {
  trigger: string;
  title: string;
  body: string;
  close: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const bodyId = useId();
  return (
    <>
      <Button variant="secondary" onClick={() => ref.current?.showModal()}>
        {trigger}
      </Button>
      <dialog ref={ref} aria-labelledby={headingId} aria-describedby={bodyId}>
        <h2 id={headingId}>{title}</h2>
        <p id={bodyId}>{body}</p>
        <form method="dialog">
          <Button>{close}</Button>
        </form>
      </dialog>
    </>
  );
}
