"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";

type Side = "HOST" | "GUEST";

const ICE: RTCConfiguration = {
  // On a shared Wi-Fi the peers connect over their LAN (host) candidates and
  // never need these; STUN only matters when the two are on different networks.
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

const POLL_MS = 900;

function clock(seconds: number) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * A two-party video call. Camera and microphone are real (getUserMedia) and
 * the media flows peer-to-peer over WebRTC; the handshake is relayed through
 * the `video_signal` table by /api/signal.
 *
 * Protocol: on joining, each side skips the room's history and posts HELLO.
 * The host answers any guest HELLO with a fresh OFFER; the guest answers a
 * host HELLO with its own HELLO. So it does not matter who joins first, or
 * who refreshes mid-call — the next HELLO renegotiates from scratch.
 */
export function VideoConsole({
  room,
  counterpart,
  subtitle,
  autoJoin = false,
}: {
  room: string;
  counterpart: string;
  subtitle?: string;
  autoJoin?: boolean;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sideRef = useRef<Side | null>(null);
  const sinceRef = useRef(0);
  const joinedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Remote candidates that arrive before the remote description is set.
  const remoteIceRef = useRef<RTCIceCandidateInit[]>([]);
  // Local candidates held back until our offer/answer is in the room: an OFFER
  // clears the room, so a candidate posted ahead of it would be deleted.
  const localIceRef = useRef<RTCIceCandidateInit[] | null>(null);
  const autoJoined = useRef(false);

  const url = `/api/signal/${encodeURIComponent(room)}`;

  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [side, setSide] = useState<Side | null>(null);
  const [status, setStatus] = useState("");
  const [peerHere, setPeerHere] = useState(false);
  const [remoteUp, setRemoteUp] = useState(false);
  const [connState, setConnState] = useState("new");
  const [seconds, setSeconds] = useState(0);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [hasCam, setHasCam] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const live = connState === "connected" && remoteUp;

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  const send = useCallback(
    async (kind: string, payload: unknown = null) => {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, payload }),
      });
    },
    [url],
  );

  const closePeer = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    remoteIceRef.current = [];
    localIceRef.current = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
    setRemoteUp(false);
    setConnState("new");
  }, []);

  const teardown = useCallback(() => {
    joinedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    closePeer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (localRef.current) localRef.current.srcObject = null;
    setJoined(false);
    setSeconds(0);
    setPeerHere(false);
  }, [closePeer]);

  // Closing the tab mid-call tells the other side straight away.
  useEffect(() => {
    function bye() {
      if (joinedRef.current) navigator.sendBeacon(url, JSON.stringify({ kind: "LEAVE" }));
    }
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      bye();
      teardown();
    };
  }, [url, teardown]);

  function newPeer() {
    closePeer();
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    localIceRef.current = [];

    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    // Without a camera or mic we still receive the other side.
    if (!stream?.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });
    if (!stream?.getAudioTracks().length) pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      const el = remoteRef.current;
      if (!el) return;
      const remote = event.streams[0] ?? new MediaStream([event.track]);
      if (el.srcObject !== remote) el.srcObject = remote;
      el.play().then(
        () => setNeedsTap(false),
        () => setNeedsTap(true),
      );
      setRemoteUp(true);
    };
    pc.onicecandidate = (event) => {
      if (!event.candidate || pcRef.current !== pc) return;
      const c = event.candidate.toJSON();
      if (localIceRef.current) localIceRef.current.push(c);
      else void send("ICE", c);
    };
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      setConnState(pc.connectionState);
      if (pc.connectionState === "failed") setRemoteUp(false);
    };
    return pc;
  }

  async function flushLocalIce() {
    const queued = localIceRef.current ?? [];
    localIceRef.current = null;
    for (const c of queued) await send("ICE", c);
  }

  async function flushRemoteIce(pc: RTCPeerConnection) {
    const queued = remoteIceRef.current;
    remoteIceRef.current = [];
    for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
  }

  async function makeOffer() {
    const pc = newPeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await send("OFFER", pc.localDescription);
    await flushLocalIce();
  }

  async function handle(kind: string, payload: unknown) {
    const me = sideRef.current;
    if (kind === "HELLO") {
      if (me === "HOST") await makeOffer();
      else await send("HELLO");
    } else if (kind === "OFFER" && me === "GUEST") {
      const pc = newPeer();
      await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
      await flushRemoteIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send("ANSWER", pc.localDescription);
      await flushLocalIce();
    } else if (kind === "ANSWER" && me === "HOST") {
      const pc = pcRef.current;
      if (pc?.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        await flushRemoteIce(pc);
      }
    } else if (kind === "ICE" && payload) {
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) remoteIceRef.current.push(payload as RTCIceCandidateInit);
      else await pc.addIceCandidate(payload as RTCIceCandidateInit).catch(() => {});
    } else if (kind === "LEAVE") {
      closePeer();
    }
  }

  async function poll() {
    if (!joinedRef.current) return;
    try {
      const res = await fetch(`${url}?since=${sinceRef.current}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error ?? "The room is not reachable.");
      } else {
        setPeerHere(Boolean(data.peerHere));
        setStatus(data.status);
        for (const signal of data.signals as { signal_id: number; kind: string; payload: string }[]) {
          sinceRef.current = Math.max(sinceRef.current, signal.signal_id);
          await handle(signal.kind, JSON.parse(signal.payload)).catch(() => {});
        }
      }
    } catch {
      /* best-effort; the next tick retries */
    }
    if (joinedRef.current) timerRef.current = setTimeout(poll, POLL_MS);
  }

  async function getMedia(): Promise<MediaStream | null> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice(
        window.isSecureContext
          ? "This browser cannot capture a camera. You will still see and hear the other side."
          : `Camera access needs HTTPS. Open this page as https://${location.host.replace(/:\d+$/, "")}:3443 (run "npm run lan") — you will still see the other side meanwhile.`,
      );
      return null;
    }
    const attempts: MediaStreamConstraints[] = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true },
      { video: false, audio: true },
    ];
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!constraints.video) {
          setNotice("No camera available (it may be in use by another app) — joined with audio only.");
        }
        return stream;
      } catch {
        /* try the next, smaller ask */
      }
    }
    setNotice("Camera and microphone were blocked. Allow them in the address bar and rejoin — you can still watch.");
    return null;
  }

  async function join() {
    if (joinedRef.current || connecting) return;
    setConnecting(true);
    setNotice(null);
    try {
      const peek = await fetch(`${url}?since=0`, { cache: "no-store" });
      const info = await peek.json();
      if (!peek.ok) {
        setNotice(info.error ?? "Could not open the room.");
        return;
      }
      sideRef.current = info.side;
      setSide(info.side);
      setStatus(info.status);
      sinceRef.current = info.lastId;

      const stream = await getMedia();
      streamRef.current = stream;
      setHasCam(Boolean(stream?.getVideoTracks().length));
      setCamOn(true);
      setMicOn(true);
      if (localRef.current) localRef.current.srcObject = stream;

      joinedRef.current = true;
      setJoined(true);
      setSeconds(0);
      await send("HELLO");
      // Ring the guest when nobody has yet: a call placed from the Calls page
      // is already ringing, and a declined one stays declined until "Ring again".
      if (info.side === "HOST" && !info.peerHere && ["OPEN", "ENDED", "MISSED"].includes(info.status)) {
        await fetch(`/api/calls/${encodeURIComponent(room)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ring" }),
        });
      }
      void poll();
    } catch {
      setNotice("Could not reach the server. Check that both devices are on the same network.");
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    if (autoJoin && !autoJoined.current) {
      autoJoined.current = true;
      void join();
    }
    // join is stable enough for a one-shot auto start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin]);

  async function leave() {
    joinedRef.current = false;
    await send("LEAVE").catch(() => {});
    teardown();
    setStatus("ENDED");
  }

  async function ringAgain() {
    await fetch(`/api/calls/${encodeURIComponent(room)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ring" }),
    });
    setStatus("RINGING");
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

  async function copyCode() {
    await navigator.clipboard?.writeText(room).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const waitingText = !joined
    ? `${counterpart} will appear here`
    : status === "DECLINED"
      ? `${counterpart} declined the call`
      : status === "MISSED"
        ? `${counterpart} did not pick up`
        : peerHere
          ? connState === "connected"
            ? "Connected — waiting for video…"
            : `${counterpart} is here — connecting…`
          : side === "HOST" && status === "RINGING"
            ? `Ringing ${counterpart}…`
            : `Waiting for ${counterpart} to join`;

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      {/* ------------------------------------------------------------- header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-toolbar px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="label text-ink-mute">Video call</p>
          <p className="truncate font-serif text-[16px] leading-tight text-ink">
            {subtitle ?? counterpart}
          </p>
        </div>
        <button
          onClick={copyCode}
          title="Copy the room code"
          className="mono flex items-center gap-1.5 rounded border border-dashed border-line-strong bg-surface px-2.5 py-1 text-[12px] tracking-wider text-ink transition hover:border-brand"
        >
          {room}
          {copied ? <Check size={12} className="text-brand" /> : <Copy size={12} className="text-ink-mute" />}
        </button>
        {live ? (
          <span className="label flex items-center gap-1.5 rounded bg-brand px-2.5 py-1 text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Live · {clock(seconds)}
          </span>
        ) : joined ? (
          <span className="label rounded border border-line-strong px-2.5 py-1 text-ink-soft">
            {peerHere ? "Connecting" : status === "RINGING" ? "Ringing" : "Waiting"}
          </span>
        ) : null}
      </div>

      {/* -------------------------------------------------------------- stage */}
      <div className="relative bg-[#0f1f1c]">
        {/* Fits the viewport, so the controls below never scroll out of reach. */}
        <div className="relative mx-auto aspect-video w-full max-w-[calc((100vh_-_300px)*16/9)] min-w-0">
          <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
          {!remoteUp && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div>
                <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border border-white/15 font-serif text-[20px] text-white/80">
                  {initials(counterpart)}
                </span>
                <p className="text-[13px] text-white/70">{waitingText}</p>
                {joined && side === "HOST" && !peerHere && status !== "RINGING" && (
                  <button
                    onClick={ringAgain}
                    className="label mt-3 inline-flex items-center gap-1.5 rounded border border-white/25 px-3 py-1.5 text-white/85 transition hover:bg-white/10"
                  >
                    <PhoneCall size={12} /> Ring again
                  </button>
                )}
              </div>
            </div>
          )}
          {needsTap && remoteUp && (
            <button
              onClick={() => remoteRef.current?.play().then(() => setNeedsTap(false), () => {})}
              className="label absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1.5 rounded bg-white px-3 py-1.5 text-ink shadow"
            >
              <Volume2 size={13} /> Tap to hear {counterpart}
            </button>
          )}
          <span className="label absolute left-3 top-3 rounded bg-black/45 px-2 py-1 text-white/85">
            {counterpart}
          </span>

          {/* picture-in-picture self view */}
          <div className="absolute bottom-3 right-3 aspect-video w-[30%] min-w-[120px] max-w-[260px] overflow-hidden rounded border border-white/20 bg-black/60">
            <video ref={localRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
            {(!joined || !hasCam || !camOn) && (
              <div className="absolute inset-0 grid place-items-center text-[11px] text-white/50">
                {!joined ? "Your camera" : !hasCam ? "No camera" : "Camera off"}
              </div>
            )}
            <span className="label absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[9.5px] text-white/80">
              You
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        {!joined ? (
          <button
            onClick={join}
            disabled={connecting}
            className="flex items-center gap-2 rounded bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
          >
            <Video size={14} />
            {connecting ? "Joining…" : "Join call"}
          </button>
        ) : (
          <>
            <CtrlButton on={micOn} onClick={toggleMic} disabled={!streamRef.current?.getAudioTracks().length}>
              {micOn ? <Mic size={14} /> : <MicOff size={14} />}
              {micOn ? "Mute" : "Unmute"}
            </CtrlButton>
            <CtrlButton on={camOn} onClick={toggleCam} disabled={!hasCam}>
              {camOn ? <Video size={14} /> : <VideoOff size={14} />}
              {camOn ? "Stop video" : "Start video"}
            </CtrlButton>
            <button
              onClick={leave}
              className="flex items-center gap-1.5 rounded bg-danger px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
            >
              <PhoneOff size={14} />
              Leave
            </button>
          </>
        )}

        <span className="mono ml-auto text-[11px] text-ink-mute">
          {joined ? `${side?.toLowerCase()} · ${connState}` : "not joined"}
        </span>
      </div>

      {notice && (
        <p className="border-t border-warn/30 bg-warn-wash px-4 py-2.5 text-[12px] text-warn">{notice}</p>
      )}
    </div>
  );
}

function CtrlButton({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded border px-3 py-2 text-[12px] font-medium transition disabled:opacity-40 ${
        on ? "border-line bg-surface text-ink-soft hover:bg-sunk" : "border-danger/40 bg-danger-wash text-danger"
      }`}
    >
      {children}
    </button>
  );
}

function initials(name: string) {
  return name
    .replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}
