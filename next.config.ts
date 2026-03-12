import type { NextConfig } from "next";
import { tools } from "./data/tools";

const nextConfig: NextConfig = {
  async rewrites() {
    return tools
      .filter((t) => t.embedSrc)
      .map((t) => ({
        source: `/${t.slug}`,
        destination: t.embedSrc!,
      }));
  },
};

export default nextConfig;
