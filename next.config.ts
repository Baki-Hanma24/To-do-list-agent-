import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // The agents read their instructions, templates and reference files at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./workflows/**/*", "./templates/**/*", "./resources/**/*", "./drizzle/**/*"],
  },
};

export default nextConfig;
