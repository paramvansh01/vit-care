// A private certificate authority for the LAN server.
//
// A self-signed server certificate makes every browser say "Not secure".
// Instead, VIT-Care mints its own small CA once (data/certs/ca.crt), and signs
// the server's certificate with it. Any device that trusts ca.crt once - this
// laptop via `npm run trust`, others by installing the file served at
// /vitcare-ca.crt - then shows a normal padlock. The CA is never regenerated,
// so a device that trusted it keeps trusting it; the server certificate is
// re-signed whenever this machine's addresses change.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import forge from "node-forge";

const pki = forge.pki;
export const CERT_DIR = path.join(process.cwd(), "data", "certs");
export const CA_FILE = path.join(CERT_DIR, "ca.crt");
const CA_KEY_FILE = path.join(CERT_DIR, "ca-key.pem");
const KEY_FILE = path.join(CERT_DIR, "server-key.pem");
const CERT_FILE = path.join(CERT_DIR, "server.crt");
const NAMES_FILE = path.join(CERT_DIR, "server-names.json");

export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/vethernet|virtualbox|vmware|docker|wsl|loopback/i.test(name)) continue;
    for (const a of list ?? []) {
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) out.push(a.address);
    }
  }
  return out;
}

function serial() {
  // Positive, unique enough for a private CA.
  return "01" + forge.util.bytesToHex(forge.random.getBytesSync(15));
}

function years(from, n) {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + n);
  return d;
}

/** Loads the CA, creating it the first time. */
export function loadCa() {
  if (fs.existsSync(CA_FILE) && fs.existsSync(CA_KEY_FILE)) {
    return {
      cert: pki.certificateFromPem(fs.readFileSync(CA_FILE, "utf8")),
      key: pki.privateKeyFromPem(fs.readFileSync(CA_KEY_FILE, "utf8")),
    };
  }
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = years(Date.now(), 10);
  const subject = [
    { name: "commonName", value: `VIT-Care Local CA (${os.hostname()})` },
    { name: "organizationName", value: "VIT-Care" },
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(CA_KEY_FILE, pki.privateKeyToPem(keys.privateKey));
  fs.writeFileSync(CA_FILE, pki.certificateToPem(cert));
  return { cert, key: keys.privateKey };
}

/** The server's key and certificate, re-signed when the LAN addresses change. */
export function serverCredentials(ips) {
  const names = ["localhost", "127.0.0.1", os.hostname(), ...ips];
  const ca = loadCa();

  try {
    const cached = JSON.parse(fs.readFileSync(NAMES_FILE, "utf8"));
    const cert = pki.certificateFromPem(fs.readFileSync(CERT_FILE, "utf8"));
    const fresh = cert.validity.notAfter.getTime() - Date.now() > 7 * 86_400_000;
    const sameCa = cert.issuer.hash === ca.cert.subject.hash;
    if (fresh && sameCa && names.every((n) => cached.includes(n))) {
      return { key: fs.readFileSync(KEY_FILE), cert: fs.readFileSync(CERT_FILE) };
    }
  } catch {
    /* nothing cached yet */
  }

  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  // Browsers cap server certificates at 398 days.
  cert.validity.notAfter = new Date(Date.now() + 397 * 86_400_000);
  cert.setSubject([{ name: "commonName", value: ips[0] ?? "localhost" }]);
  cert.setIssuer(ca.cert.subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true, critical: true },
    { name: "extKeyUsage", serverAuth: true },
    {
      name: "subjectAltName",
      altNames: names.map((n) => (/^\d+\.\d+\.\d+\.\d+$/.test(n) ? { type: 7, ip: n } : { type: 2, value: n })),
    },
    { name: "subjectKeyIdentifier" },
    { name: "authorityKeyIdentifier", keyIdentifier: ca.cert.generateSubjectKeyIdentifier().getBytes() },
  ]);
  cert.sign(ca.key, forge.md.sha256.create());

  const keyPem = pki.privateKeyToPem(keys.privateKey);
  // Send the chain, so a device only ever needs the CA itself.
  const chainPem = pki.certificateToPem(cert) + pki.certificateToPem(ca.cert);
  fs.writeFileSync(KEY_FILE, keyPem);
  fs.writeFileSync(CERT_FILE, chainPem);
  fs.writeFileSync(NAMES_FILE, JSON.stringify(names));
  return { key: keyPem, cert: chainPem };
}
