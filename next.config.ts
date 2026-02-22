// next.config.ts
import path from 'path'
import type { NextConfig } from 'next'

const isStaging = process.env.APP_ENV === 'staging'

const nextConfig: NextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    })

    // Alias "@"
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src')
    }

    return config
  },

  // Enable browser sourcemaps ONLY on staging to expose React #310 culprit
  productionBrowserSourceMaps: isStaging,

  async rewrites() {
    // Required environment variables:
    // - Local prod: BACKEND_ORIGIN (defaults to 'http://127.0.0.1:5000')
    // - VPS: USE_NGINX_PROXY=true (disables rewrites, nginx handles routing)

    if (process.env.USE_NGINX_PROXY === 'true') {
      return []
    }

    const backendOrigin = process.env.BACKEND_ORIGIN || 'http://127.0.0.1:5000'
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backendOrigin}/api/backend/:path*`
      }
    ]
  }
}

export default nextConfig