"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Radio,
  ShieldCheck,
  Video,
  VideoOff,
  Wifi,
} from "lucide-react";

type Role = "DOCTOR" | "STUDENT";

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

function clock(seconds: number) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Teleconsultation room. The camera and microphone are real (getUserMedia),
 * and the WebRTC handshake is relayed through the `video_signal` table, so two
 * browsers pointed at the same room code connect peer-to-peer with the
 * project's own database acting as the signalling channel.
 */
export function VideoConsole({
  room,
  role,
  counterpart,
  subtitle,
}: {
  room: string;
  role: Role;
  counterpart: string;
  subtitle?: string;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sinceRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const politeRef = useRef(role === "STUDENT");

  const [live, setLive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [state, setState] = useState<string>("idle");
  const [remoteUp, setRemoteUp] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const elapsed = clock(seconds);

  // The call timer only runs while the call is up; both ends reset it in the
  // handlers, so nothing has to be reset from inside an effect.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  const post = useCallback(
    async (kind: string, payload: unknown) => {
      await fetch(`/api/signal/${encodeURIComponent(room)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: role, kind, payload }),
      });
    },
    [room, role],
  );

  const teardown = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (localRef.current) localRef.current.srcObject = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
    sinceRef.current = 0;
    setLive(false);
    setSeconds(0);
    setRemoteUp(false);
    setState("idle");
    setPeers([]);
  }, []);

  useEffect(() => teardown, [teardown]);

  async function join() {
    setError(null);
    setState("requesting camera");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
    } catch {
      setError(
        "The browser would not hand over the camera or microphone. Allow access for this site and try again — the room itself is live either way.",
      );
      setState("blocked");
      setSeconds(0);
      setLive(true);
      startPolling(null);
      return;
    }

    streamRef.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;
    setSeconds(0);
    setLive(true);
    setState("connecting");

    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteRef.current) remoteRef.current.srcObject = event.streams[0];
      setRemoteUp(true);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) void post("ICE", event.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      setState(pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") setRemoteUp(false);
    };

    // The doctor opens the room, the student answers. That keeps the handshake
    // deterministic regardless of who clicks Join first.
    if (role === "DOCTOR") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await post("OFFER", offer);
    }
    startPolling(pc);
  }

  function startPolling(pc: RTCPeerConnection | null) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/signal/${encodeURIComponent(room)}?since=${sinceRef.current}&me=${role}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          signals: { signal_id: number; kind: string; payload: string }[];
          peers: string[];
        };
        setPeers(data.peers ?? []);

        for (const signal of data.signals ?? []) {
          sinceRef.current = Math.max(sinceRef.current, signal.signal_id);
          if (!pc) continue;
          const payload = JSON.parse(signal.payload);

          if (signal.kind === "OFFER") {
            // A doctor re-opening the room re-offers; the student always yields.
            if (pc.signalingState !== "stable" && !politeRef.current) continue;
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await post("ANSWER", answer);
          } else if (signal.kind === "ANSWER") {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(payload));
            }
          } else if (signal.kind === "ICE" && payload) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload));
            } catch {
              /* a candidate arriving before the remote description is normal */
            }
          } else if (signal.kind === "LEAVE") {
            setRemoteUp(false);
          }
        }
      } catch {
        /* the poll is best-effort; the next tick retries */
      }
    }, 1200);
  }

  async function leave() {
    await post("LEAVE", null).catch(() => {});
    teardown();
  }

  function toggleCam() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  const connected = state === "connected";

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[#0b1220] text-white shadow-lg">
      {/* ------------------------------------------------------------- header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/20 text-brand">
          <Video size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">Teleconsultation room</p>
          <p className="truncate text-[11px] text-white/50">
            {subtitle ?? `You are joining as the ${role.toLowerCase()}`}
          </p>
        </div>
        <span className="mono rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] tracking-wide">
          {room}
        </span>
        {live && (
          <span className="flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300">
            <Radio size={11} className="live-dot" />
            {elapsed}
          </span>
        )}
      </div>

      {/* -------------------------------------------------------------- stage */}
      <div className="grid gap-2.5 p-3 sm:grid-cols-2">
        <Tile
          label={role === "DOCTOR" ? "You · Doctor" : "You · Student"}
          hint={camOn ? undefined : "camera off"}
        >
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full scale-x-[-1] object-cover"
          />
          {!live && <Placeholder text="Your camera preview appears here" />}
        </Tile>

        <Tile
          label={counterpart}
          hint={remoteUp ? "connected" : live ? "waiting to join" : undefined}
          accent={remoteUp}
        >
          <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
          {!remoteUp && (
            <Placeholder
              text={
                live
                  ? `Waiting for ${counterpart} to join room ${room}…`
                  : `${counterpart} will appear here once both sides join`
              }
            />
          )}
        </Tile>
      </div>

      {/* ------------------------------------------------------------ controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
        {!live ? (
          <button
            onClick={join}
            className="flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-deep"
          >
            <Video size={14} />
            Join the call
          </button>
        ) : (
          <>
            <button
              onClick={toggleMic}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition ${
                micOn ? "bg-white/10 hover:bg-white/15" : "bg-rose-500/25 text-rose-200"
              }`}
            >
              {micOn ? <Mic size={14} /> : <MicOff size={14} />}
              {micOn ? "Mute" : "Unmute"}
            </button>
            <button
              onClick={toggleCam}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition ${
                camOn ? "bg-white/10 hover:bg-white/15" : "bg-rose-500/25 text-rose-200"
              }`}
            >
              {camOn ? <Video size={14} /> : <VideoOff size={14} />}
              {camOn ? "Stop video" : "Start video"}
            </button>
            <button
              onClick={leave}
              className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-rose-600"
            >
              <PhoneOff size={14} />
              Leave
            </button>
          </>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-white/45">
          <span className="flex items-center gap-1.5">
            <Wifi size={11} className={connected ? "text-emerald-400" : "text-white/40"} />
            {state}
          </span>
          {peers.length > 0 && (
            <span className="rounded-md bg-white/5 px-1.5 py-0.5">
              {peers.length} peer{peers.length > 1 ? "s" : ""} in room
            </span>
          )}
          <span className="hidden items-center gap-1.5 sm:flex">
            <ShieldCheck size={11} className="text-brand" />
            signalling via <span className="mono">video_signal</span>
          </span>
        </span>
      </div>

      {error && (
        <p className="border-t border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-[11.5px] text-amber-200">
          {error}
        </p>
      )}

      <p className="flex items-start gap-2 border-t border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11px] leading-relaxed text-white/45">
        <MonitorUp size={12} className="mt-0.5 shrink-0" />
        Open this same room code as the other role in a second browser window — the SDP offer,
        answer and ICE candidates travel through the <span className="mono">video_signal</span> table,
        so the two peers connect without any third-party service.
      </p>
    </div>
  );
}

function Tile({
  label,
  hint,
  accent = false,
  children,
}: {
  label: string;
  hint?: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-xl border bg-black/50 ${
        accent ? "border-brand/50" : "border-white/10"
      }`}
    >
      {children}
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10.5px] font-medium backdrop-blur-sm">
        {label}
        {hint && <span className="text-white/45">· {hint}</span>}
      </span>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center px-6 text-center">
      <div>
        <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/30">
          <Video size={17} />
        </span>
        <p className="text-[11.5px] leading-relaxed text-white/35">{text}</p>
      </div>
    </div>
  );
}
