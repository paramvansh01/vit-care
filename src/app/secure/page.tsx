import { Download } from "lucide-react";
import { Page } from "@/components/ui";
import { lanUrls, servingOverLan } from "@/lib/network";

export const dynamic = "force-dynamic";

const STEPS: { device: string; steps: string[] }[] = [
  {
    device: "Windows · Chrome or Edge",
    steps: [
      "Download the certificate below and open the file.",
      "Install Certificate → Current User → Next.",
      "Place all certificates in the following store → Browse → Trusted Root Certification Authorities → OK → Next → Finish, and answer Yes.",
      "Close every browser window and reopen this address.",
    ],
  },
  {
    device: "macOS · Chrome or Safari",
    steps: [
      "Download the certificate and open it — Keychain Access adds it to “login”.",
      "Double-click “VIT-Care Local CA”, expand Trust, set “When using this certificate” to Always Trust.",
      "Close the window (enter your password), then restart the browser.",
    ],
  },
  {
    device: "Android · Chrome",
    steps: [
      "Download the certificate.",
      "Settings → Security → More security settings → Encryption & credentials → Install a certificate → CA certificate.",
      "Choose vitcare-ca.crt, then reopen this address in Chrome.",
    ],
  },
  {
    device: "iPhone / iPad · Safari",
    steps: [
      "Download the certificate and allow the profile.",
      "Settings → General → VPN & Device Management → install the VIT-Care profile.",
      "Settings → General → About → Certificate Trust Settings → turn on VIT-Care Local CA.",
    ],
  },
];

export default function SecurePage() {
  const urls = lanUrls();
  const lan = servingOverLan();

  return (
    <Page>
      <div className="space-y-5">
        <div>
          <h2 className="text-[26px] leading-tight">Removing “Not secure”</h2>
          <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-ink-soft">
            This server signs its HTTPS certificate with a certificate authority that was created on this laptop,
            not one your browser already knows. The connection is still encrypted, and the camera and calls work
            either way, but the browser warns until the device trusts that authority. Trust it once per device and
            the warning is gone for good.
          </p>
        </div>

        {!lan && (
          <div className="rounded-md border border-warn/30 bg-warn-wash px-4 py-3 text-[13px] text-warn">
            This server was not started with <span className="mono">npm run lan</span>, so it is not serving
            HTTPS to the network yet.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="panel-dashed p-4">
            <p className="eyebrow">On the laptop running VIT-Care</p>
            <p className="mt-2 text-[13px] text-ink-soft">Stop nothing — in a second terminal run:</p>
            <p className="mono mt-2 rounded bg-sunk px-3 py-2 text-[13px]">npm run trust</p>
            <p className="mt-2 text-[12.5px] text-ink-mute">
              Answer Yes in the Windows dialog, then restart the browser.
            </p>
          </div>
          <div className="rounded-md bg-brand p-4 text-white">
            <p className="label text-white/80">On every other device</p>
            <a
              href="/vitcare-ca.crt"
              className="mt-3 inline-flex items-center gap-2 rounded bg-white px-4 py-2.5 text-[13px] font-semibold text-brand-deep transition hover:bg-brand-wash"
            >
              <Download size={14} /> Download vitcare-ca.crt
            </a>
            {urls[0] && (
              <p className="mt-3 text-[12px] text-white/85">
                Also at <span className="mono">{urls[0].replace("https://", "http://").replace(/:\d+$/, ":3000")}/vitcare-ca.crt</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.device} className="card p-4">
              <p className="font-serif text-[17px] font-semibold">{s.device}</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] text-ink-soft">
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-ink-mute">
          Only the public certificate is downloadable; the authority&apos;s private key never leaves{" "}
          <span className="mono">data/certs/</span> on this laptop. Trusting it lets this laptop vouch for websites
          on your device, so remove it after the demo if you like (Windows: <span className="mono">certmgr.msc</span>{" "}
          → Trusted Root → delete “VIT-Care Local CA”).
        </p>
      </div>
    </Page>
  );
}
