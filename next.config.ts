import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for multi-stage Docker builds — copies only the minimum
  // files needed to run the app into the final image.
  output: "standalone",
};

export default nextConfig;
