import React, { useEffect, useRef } from "react";

export default function ReaderSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="reader-sheet"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientY < r.top ||
            event.clientX < r.left ||
            event.clientX > r.right
          )
            onClose();
        }
      }}
    >
      <div className="sheet-handle" />
      <header className="sheet-heading">
        <h2>{title}</h2>
        <button aria-label="Back to reading" onClick={onClose}>
          ✕
        </button>
      </header>
      {children}
    </dialog>
  );
}
