"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { resetDb, signIn, type AuthResult } from "@/app/auth-actions";
import { Field, Feedback, useKeptForm } from "@/components/care-ui";
import { DoctorForm } from "@/components/doctor-form";
import { StudentProfileForm } from "@/components/student-portal";

type Mode = "signin" | "student" | "doctor";

export function AuthScreen({
  next,
  campusList,
  deptList,
  specs,
  counts,
  lanUrls,
}: {
  next: string;
  campusList: { campus_id: number; code: string; name: string }[];
  deptList: { dept_id: number; campus_id: number; code: string; name: string }[];
  specs: { spec_id: number; name: string }[];
  counts: { students: number; doctors: number; accounts: number };
  lanUrls: string[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(counts.accounts ? "signin" : "student");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AuthResult | null>(null);
  const { attach, onSubmit, onInput } = useKeptForm(result, submit);

  function submit(form: FormData) {
    start(async () => {
      const res = await signIn(form);
      setResult(res);
      if (res.ok && res.next) {
        router.push(res.next);
        router.refresh();
      }
    });
  }

  function loadSample() {
    if (!confirm("Load the sample students and doctors? Anything already in the database is wiped.")) return;
    start(async () => {
      const res = await resetDb(true);
      setResult(res);
      setMode("signin");
      router.refresh();
    });
  }

  const MODES: { id: Mode; label: string }[] = [
    { id: "signin", label: "Sign in" },
    { id: "student", label: "New student" },
    { id: "doctor", label: "New doctor" },
  ];

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0">
        <div className="card overflow-hidden">
          <div className="flex gap-0 border-b border-line bg-toolbar px-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  setResult(null);
                }}
                className={[
                  "label border-b-2 px-4 py-3 transition",
                  mode === m.id ? "border-brand-deep text-ink" : "border-transparent text-ink-soft hover:text-ink",
                ].join(" ")}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-6">
            {mode === "signin" && (
              <form ref={attach} onSubmit={onSubmit} onInput={onInput} className="max-w-md space-y-4">
                <h2 className="text-[28px] leading-tight">Welcome back</h2>
                <p className="text-[13px] text-ink-soft">
                  Students sign in with their registration number, doctors with their email.
                </p>
                <input type="hidden" name="next" value={next} />
                <Field label="Registration number or email" required>
                  <input
                    name="username"
                    autoComplete="username"
                    placeholder="Registration number or email"
                    className="inp"
                    autoFocus
                    required
                  />
                </Field>
                <Field label="Password" required>
                  <input type="password" name="password" autoComplete="current-password" className="inp" required />
                </Field>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex items-center gap-2 rounded bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
                >
                  {pending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                  Sign in
                </button>
                <Feedback result={result} />
              </form>
            )}

            {mode === "student" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-[28px] leading-tight">Create a student account</h2>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    You are enrolled in your school&apos;s courses automatically, and your proctor and HOD receive
                    any medical-leave letter a doctor issues you.
                  </p>
                </div>
                <StudentProfileForm profile={null} campusList={campusList} deptList={deptList} register />
              </div>
            )}

            {mode === "doctor" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-[28px] leading-tight">Register as a doctor</h2>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    A week of consultation slots is published for you as soon as you register.
                  </p>
                </div>
                <DoctorForm campuses={campusList} specs={specs} self />
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="panel-dashed p-4">
          <p className="eyebrow">In the database now</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Count n={counts.students} k="Students" />
            <Count n={counts.doctors} k="Doctors" />
            <Count n={counts.accounts} k="Logins" />
          </div>
          {counts.accounts === 0 && (
            <div className="mt-4 border-t border-dashed border-line-strong pt-3 text-[12.5px] text-ink-soft">
              Nobody has signed up yet. Create the first account, or{" "}
              <button onClick={loadSample} disabled={pending} className="font-medium text-brand-deep underline underline-offset-2">
                load the sample people
              </button>{" "}
              (password <span className="mono">vitcare</span>).
            </div>
          )}
        </div>

        <div className="rounded-md bg-brand p-4 text-white">
          <p className="label text-white/80">Video calls on the same Wi-Fi</p>
          {lanUrls.length ? (
            <>
              <p className="mt-2 text-[12.5px] leading-relaxed text-white/90">On the other laptop or phone, open:</p>
              {lanUrls.map((u) => (
                <p key={u} className="mono mt-1 break-all rounded bg-white/15 px-2 py-1 text-[12.5px]">
                  {u}
                </p>
              ))}
              <p className="mt-2 text-[12px] leading-relaxed text-white/80">
                {lanUrls[0].startsWith("https")
                  ? "Then sign in there as the other person. A “Not secure” warning is harmless — see /secure to remove it."
                  : 'Camera access needs HTTPS — start the server with "npm run lan" to get an https:// address.'}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[12.5px] text-white/90">This machine is not on a network right now.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Count({ n, k }: { n: number; k: string }) {
  return (
    <div>
      <p className="font-serif text-[26px] leading-none">{n}</p>
      <p className="eyebrow mt-1">{k}</p>
    </div>
  );
}
