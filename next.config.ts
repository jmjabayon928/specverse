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
  productionBrowserSourceMaps: true,
  async rewrites() {
    // Required environment variables:
    // - Local prod: BACKEND_ORIGIN (defaults to 'http://127.0.0.1:5000')
    // - VPS: USE_NGINX_PROXY=true (disables rewrites, nginx handles routing)
    
    // If USE_NGINX_PROXY is set to 'true' (VPS stage/prod), disable rewrites
    // Frontend will use same-origin requests via nginx gateway
    if (process.env.USE_NGINX_PROXY === 'true') {
      return []
    }

    // Local dev/prod: use proxy rewrites to backend server
    const backendOrigin = process.env.BACKEND_ORIGIN || 'http://127.0.0.1:5000'
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendOrigin}/api/backend/:path*`,
      },
    ];
  },
};

export default nextConfig;
