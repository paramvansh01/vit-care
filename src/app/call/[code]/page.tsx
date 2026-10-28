import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Page } from "@/components/ui";
import { VideoConsole } from "@/components/video-console";
import { requireUser } from "@/lib/auth";
import { callByCode, counterpartName, normaliseCode, sideFor } from "@/lib/calls";

export const dynamic = "force-dynamic";

export default async function CallPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ join?: string }>;
}) {
  const code = normaliseCode(decodeURIComponent((await params).code));
  const me = await requireUser(undefined, `/call/${code}`);
  const { join } = await searchParams;
  const call = callByCode(code);
  const side = call ? sideFor(call, me.user_id) : null;

  return (
    <Page>
      <Link href="/calls" className="label mb-4 inline-flex items-center gap-1.5 text-ink-soft hover:text-ink">
        <ArrowLeft size={13} /> All calls
      </Link>

      {!call ? (
        <Problem title={`No room called ${code}`}>
          Check the code with the person who gave it to you — codes look like <span className="mono">ABC-123</span>.
        </Problem>
      ) : !side ? (
        <Problem title="This room is taken">
          Room <span className="mono">{code}</span> is a call between two other people.
        </Problem>
      ) : (
        <div className="space-y-3">
          <VideoConsole
            room={code}
            counterpart={call.callee_id || side === "GUEST" ? counterpartName(call, side) : "your guest"}
            subtitle={
              call.appointment_id
                ? `Consultation · appointment #${call.appointment_id}`
                : side === "HOST" && !call.callee_id
                  ? `Open room — share the code ${code}`
                  : `Call with ${counterpartName(call, side)}`
            }
            autoJoin={join === "1"}
          />
          <p className="text-[12px] text-ink-mute">
            Audio and video go straight between the two browsers (WebRTC). Only the connection handshake passes
            through this server, as rows in <span className="mono">video_signal</span>.
          </p>
        </div>
      )}
    </Page>
  );
}

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-danger p-5 text-white">
      <h2 className="text-[22px]">{title}</h2>
      <p className="mt-1 text-[13px] text-white/90">{children}</p>
    </div>
  );
}
