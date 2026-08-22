import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The icon set and avatar live in Postgres (see app/api/icon/[file]/route.ts)
  // instead of `public/`, so the deployment payload carries no binaries. These
  // rewrites keep the original asset URLs working, which means no markup in the
  // page had to change.
  async rewrites() {
    return [
      { source: "/icons/:file", destination: "/api/icon/:file" },
      { source: "/neen-avatar.jpg", destination: "/api/icon/neen-avatar.jpg" },
    ];
  },
};

export default nextConfig;
