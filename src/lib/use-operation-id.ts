"use client";
import { useRef } from "react";
export function useOperationId() {
  const value = useRef<{ id: string; signature: string } | null>(null);
  const get = (form?: FormData) => {
    const signature = JSON.stringify(form ? Array.from(form.entries()).filter(([key]) => key !== "operationId") : []);
    if (!value.current || value.current.signature !== signature) value.current = { id: crypto.randomUUID(), signature };
    return value.current.id;
  };
  get.reset = () => { value.current = null; };
  return get;
}
