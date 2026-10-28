"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { registerDoctor, type AuthResult } from "@/app/auth-actions";
import { Field, Feedback, Segmented, useKeptForm } from "@/components/care-ui";

/**
 * Registers a doctor: the superclass row, its one EER subclass row, their
 * specialisations, a week of slots and a login. `self` is the doctor signing
 * themselves up; otherwise someone is adding a colleague.
 */
export function DoctorForm({
  campuses,
  specs,
  self = false,
  onDone,
}: {
  campuses: { campus_id: number; name: string }[];
  specs: { spec_id: number; name: string }[];
  self?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AuthResult | null>(null);
  const [type, setType] = useState("GP");
  const [formKey, setFormKey] = useState(0);
  const { attach, onSubmit, onInput } = useKeptForm(result, submit);

  function submit(form: FormData) {
    form.set("doctor_type", type);
    start(async () => {
      const res = await registerDoctor(form);
      setResult(res);
      if (!res.ok) return;
      if (res.next) router.push(res.next);
      else setFormKey((k) => k + 1);
      router.refresh();
      onDone?.();
    });
  }

  return (
    <form key={formKey} ref={attach} onSubmit={onSubmit} onInput={onInput} className="space-y-5">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Full name" required>
          <input name="name" placeholder="Dr. Full Name" className="inp" required />
        </Field>
        <Field label="Email" hint="used to sign in" required>
          <input type="email" name="email" placeholder="doctor@vit.ac.in" className="inp" required />
        </Field>
        <Field label="Medical council reg. no." required>
          <input name="reg_council_no" placeholder="Council registration no." className="inp mono uppercase" required />
        </Field>
        <Field label="Campus" required>
          <select name="campus_id" className="inp" required defaultValue={campuses[0]?.campus_id}>
            {campuses.map((c) => (
              <option key={c.campus_id} value={c.campus_id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Years of experience">
          <input type="number" name="years_experience" min={0} max={60} defaultValue={5} className="inp" />
        </Field>
        <Field label="Consultation fee (₹)">
          <input type="number" name="consult_fee" min={0} step="1" defaultValue={0} className="inp" />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-[11.5px] font-medium text-ink-soft">Kind of doctor</p>
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "GP", label: "General practitioner" },
            { value: "SPECIALIST", label: "Specialist" },
            { value: "COUNSELOR", label: "Counsellor" },
          ]}
        />
        <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
          {type === "GP" && (
            <>
              <Field label="OPD room">
                <input name="opd_room" placeholder="OPD room" className="inp" />
              </Field>
              <Field label="Walk-in hours">
                <input name="walk_in_hours" placeholder="09:00-17:00" className="inp" />
              </Field>
            </>
          )}
          {type === "SPECIALIST" && (
            <>
              <Field label="Board certification">
                <input name="board_certification" placeholder="e.g. MD" className="inp" />
              </Field>
              <Field label="Tertiary hospital">
                <input name="tertiary_hospital" placeholder="Hospital name" className="inp" />
              </Field>
            </>
          )}
          {type === "COUNSELOR" && (
            <>
              <Field label="Therapy modality">
                <input name="therapy_modality" placeholder="Cognitive Behavioural Therapy" className="inp" />
              </Field>
              <Field label="Confidentiality tier">
                <select name="confidentiality_tier" defaultValue="ELEVATED" className="inp">
                  <option value="STANDARD">Standard</option>
                  <option value="ELEVATED">Elevated</option>
                  <option value="SEALED">Sealed</option>
                </select>
              </Field>
            </>
          )}
        </div>
      </div>

      {specs.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11.5px] font-medium text-ink-soft">
            Specialisations <span className="text-ink-mute">· the first ticked is primary</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {specs.map((s) => (
              <label
                key={s.spec_id}
                className="cursor-pointer rounded border border-line px-2.5 py-1.5 text-[12.5px] text-ink-soft transition has-[:checked]:border-brand has-[:checked]:bg-brand-wash has-[:checked]:text-brand-deep"
              >
                <input type="checkbox" name="spec_id" value={s.spec_id} className="sr-only" />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3.5 border-t border-line pt-4 sm:grid-cols-2">
        <Field label={self ? "Password" : "Their initial password"} hint="at least 6 characters" required>
          <input type="password" name="password" minLength={6} autoComplete="new-password" className="inp" required />
        </Field>
        <p className="self-end pb-2 text-[12px] text-ink-mute">
          {self
            ? "You will sign in with your email and this password."
            : "Give the doctor their email and this password — they sign in on their own device."}
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
        {self ? "Create my doctor account" : "Add doctor"}
      </button>
      <Feedback result={result} />
    </form>
  );
}
