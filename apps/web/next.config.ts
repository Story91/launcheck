import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import { resolve } from "node:path";

// The team keeps a single .env at the repository root; load it for local dev (Vercel injects env itself).
loadEnv({ path: resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@tenderhound/core"],
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
