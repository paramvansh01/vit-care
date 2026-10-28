import os from "node:os";

/** Port the LAN (HTTPS) server listens on; see server.mjs. */
export const LAN_PORT = Number(process.env.VITCARE_LAN_PORT || 3443);

/** This machine's IPv4 addresses on the local network (Wi-Fi, Ethernet). */
export function lanAddresses() {
  const out: string[] = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    // Virtual adapters (WSL, Hyper-V, VirtualBox, Docker) are not reachable from a phone.
    if (/vethernet|virtualbox|vmware|docker|wsl|loopback/i.test(name)) continue;
    for (const a of list ?? []) {
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) out.push(a.address);
    }
  }
  return out;
}

/** The URLs another device on the same Wi-Fi should open. */
export function lanUrls() {
  const https = process.env.VITCARE_LAN === "1";
  return lanAddresses().map((ip) => (https ? `https://${ip}:${LAN_PORT}` : `http://${ip}:${process.env.PORT || 3000}`));
}

export function servingOverLan() {
  return process.env.VITCARE_LAN === "1";
}
