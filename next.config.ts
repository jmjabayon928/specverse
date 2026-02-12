// next.config.ts
import path from "path";
import { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    // ✅ Alias "@"
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname, "src"),
    };

    return config;
  },
  async rewrites() {
    // If NEXT_PUBLIC_API_BASE_URL is set (VPS stage/prod), disable rewrites
    // Frontend will use same-origin requests via nginx gateway
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      return [];
    }

    // Local dev: use proxy rewrites to backend server
    return [
      // existing backend proxy (kept)
      {
        source: "/api/backend/:path*",
        destination: "http://localhost:5000/api/backend/:path*",
      },
      // ✅ new: mirror API proxy
      {
        source: "/api/mirror/:path*",
        destination: "http://localhost:5000/api/mirror/:path*",
      },
    ];
  },
};

export default nextConfig;
