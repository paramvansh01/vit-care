"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { DoctorForm } from "@/components/doctor-form";

export function AddDoctorPanel({
  campuses,
  specs,
}: {
  campuses: { campus_id: number; name: string }[];
  specs: { spec_id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-deep"
      >
        <UserPlus size={14} /> Add doctor
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/25" onClick={() => setOpen(false)}>
          <div
            className="slide-in-left h-full w-full max-w-[560px] overflow-y-auto border-l border-line bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-toolbar px-5 py-3">
              <p className="font-serif text-[20px] font-semibold">Add a doctor</p>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-ink-soft hover:bg-surface" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <DoctorForm campuses={campuses} specs={specs} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
