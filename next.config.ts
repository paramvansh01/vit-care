import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay badge sits on top of the sidebar footer.
  devIndicators: false,
  // node:sqlite must stay a runtime require, never be bundled.
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
