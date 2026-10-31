"use client";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

export function useModalFocus(open: boolean, setOpen: Dispatch<SetStateAction<boolean>>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dialog.getAttribute("aria-busy") !== "true") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const controls = focusable();
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      const activeInControls = document.activeElement instanceof HTMLElement && controls.includes(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !activeInControls)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !activeInControls)) { event.preventDefault(); first.focus(); }
    }
    dialog.addEventListener("keydown", onKeyDown);
    return () => { dialog.removeEventListener("keydown", onKeyDown); if (trigger?.isConnected) trigger.focus(); };
  }, [open, setOpen]);
  return dialogRef;
}
