"use client";

import { useEffect, useRef } from "react";

/** Accessible modal built on <dialog> (focus trapping and Esc handled by the browser). */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-card p-0 text-ink shadow-soft backdrop:bg-ink/40"
    >
      <div className="p-6">
        <h2 id="dialog-title" className="font-serif text-3xl">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  );
}
