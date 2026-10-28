import os from "node:os";
import type { NextConfig } from "next";

// The dev server only serves its dev assets to localhost unless told
// otherwise; the LAN server (server.mjs) is reached by this machine's IP.
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  devIndicators: false,
  // node:sqlite must stay a runtime require, never be bundled.
  serverExternalPackages: ["node:sqlite"],
  allowedDevOrigins: [...lanHosts, os.hostname()],
};

export default nextConfig;
