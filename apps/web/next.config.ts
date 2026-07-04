import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  output: "standalone",
  transpilePackages: ["@kakoa/core", "@kakoa/db", "@kakoa/ui", "@kakoa/config"],
};

export default nextConfig;
