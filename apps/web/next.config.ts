import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import { resolve } from "node:path";

// The team keeps a single .env at the repository root; load it for local dev (Vercel injects env itself).
loadEnv({ path: resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@tendr/core"],
  // The Kite Passport CLI (scripts/fetch-kpass.mjs) must ship with the functions that pay for checks.
  outputFileTracingIncludes: {
    "/api/admin/kpass-status": ["./.kpass-bin/**"],
    "/api/admin/kpass-probe": ["./.kpass-bin/**"],
    "/api/internal/launchcheck/**": ["./.kpass-bin/**"],
    "/api/agent": ["./.kpass-bin/**"],
  },
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
