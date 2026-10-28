// VIT-Care LAN server.
//
// Browsers only hand a page the camera and microphone in a secure context:
// https://, or http://localhost. A second laptop on the same Wi-Fi reaches this
// machine by its IP address, so plain `next dev` gives it no camera at all.
// This script serves the same Next.js app over HTTPS, with a certificate
// signed by VIT-Care's own local CA (see scripts/certs.mjs).
//
//   npm run lan         development (hot reload)
//   npm run lan:prod    production build (faster, use this for the demo)
//   npm run trust       trust the CA on this laptop (removes "Not secure")

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import next from "next";
import { CA_FILE, lanAddresses, serverCredentials } from "./scripts/certs.mjs";

const prod = process.argv.includes("--prod");
const HTTPS_PORT = Number(process.env.VITCARE_LAN_PORT || 3443);
const HTTP_PORT = Number(process.env.PORT || 3000);

// Read by the app (src/lib/network.ts) to show the right address to share.
process.env.VITCARE_LAN = "1";
process.env.VITCARE_LAN_PORT = String(HTTPS_PORT);
if (prod) process.env.NODE_ENV = "production";

const ips = lanAddresses();
const credentials = serverCredentials(ips);

const app = next({ dev: !prod, hostname: "0.0.0.0", port: HTTPS_PORT });
const handle = app.getRequestHandler();
await app.prepare();
const upgrade = app.getUpgradeHandler();

/** The CA certificate, for a device to install. Never the private key. */
function serveCa(req, res) {
  if (!req.url?.startsWith("/vitcare-ca.crt")) return false;
  res.writeHead(200, {
    "Content-Type": "application/x-x509-ca-cert",
    "Content-Disposition": 'attachment; filename="vitcare-ca.crt"',
  });
  res.end(fs.readFileSync(CA_FILE));
  return true;
}

const secure = https.createServer(credentials, (req, res) => {
  if (!serveCa(req, res)) handle(req, res);
});
secure.on("upgrade", (req, socket, head) => upgrade(req, socket, head));
secure.listen(HTTPS_PORT, "0.0.0.0");

// Plain HTTP stays usable on this machine; from anywhere else it redirects to
// HTTPS, because over http:// the other device would get no camera. The CA
// file is also served over plain HTTP, so a device can fetch it before it
// trusts anything.
const plain = http.createServer((req, res) => {
  if (serveCa(req, res)) return;
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (host === "localhost" || host === "127.0.0.1") return handle(req, res);
  res.writeHead(307, { Location: `https://${host}:${HTTPS_PORT}${req.url ?? "/"}` });
  res.end();
});
plain.on("upgrade", (req, socket, head) => upgrade(req, socket, head));
plain.listen(HTTP_PORT, "0.0.0.0");

const line = "─".repeat(64);
console.log(`\n${line}\n VIT-Care is running (${prod ? "production" : "development"})\n${line}`);
console.log(` This laptop:        http://localhost:${HTTP_PORT}`);
for (const ip of ips) console.log(` Other devices:      https://${ip}:${HTTPS_PORT}`);
if (!ips.length) console.log(" (no network adapter found — connect to Wi-Fi and restart)");
console.log(line);
console.log(" Remove the \"Not secure\" warning: run `npm run trust` on this");
console.log(` laptop; on other devices open https://${ips[0] ?? "<ip>"}:${HTTPS_PORT}/secure`);
console.log(" If Windows asks whether Node.js may use the network, allow it.");
console.log(`${line}\n`);
