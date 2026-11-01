"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export function ManualPersonFields({ label, college, optional = false }: { label: string; college: ReactNode; optional?: boolean }) {
  const [enabled, setEnabled] = useState(!optional);
  return <fieldset className="space-y-3 rounded border border-border p-3">
    <legend className="px-1 text-xs font-bold text-[#3B0A0F]">{label}</legend>
    {!optional && <input type="hidden" name="includePerson" value="on" />}
    {optional && <label className="flex gap-2 text-xs"><input type="checkbox" name="includePerson" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Record who received this item (optional; otherwise track by college)</label>}
    <div className="space-y-3">
      <label hidden={!enabled} className="block text-xs font-bold">Name *<input name="personName" disabled={!enabled} hidden={!enabled} required={enabled} minLength={2} maxLength={150} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm" /></label>
      {college}
      <label hidden={!enabled} className="block text-xs font-bold">Position *<input name="personPosition" disabled={!enabled} hidden={!enabled} required={enabled} minLength={2} maxLength={150} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm" /></label>
    </div>
  </fieldset>;
}
