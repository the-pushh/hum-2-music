import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md carries the Next.js agent note, so don't generate AGENTS.md.
  agentRules: false,
  // Phone testing (see README): a Cloudflare quick tunnel, or this Mac by its Bonjour name on the local network.
  allowedDevOrigins: ["*.trycloudflare.com", "**.local"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
