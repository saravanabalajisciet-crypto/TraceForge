import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: output: "standalone" is only needed for Docker builds.
  // It is intentionally excluded here so the app deploys correctly on Vercel.
  // For Docker, add it back locally before running docker compose build.
};

export default nextConfig;
