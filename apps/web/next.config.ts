import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@next-kanban/contracts", "@next-kanban/database", "@next-kanban/auth"],
};

export default nextConfig;
