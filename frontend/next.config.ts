import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5002/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:5002/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
