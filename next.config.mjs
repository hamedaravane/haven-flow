/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables standalone output for Docker deployments
  output: "standalone",

  async headers() {
    return [
      {
        // Allow the service worker to control the entire origin
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Security headers for all routes
        source: "/(.*)",
        headers: [
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Only allow the app to be embedded on the same origin
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Enable XSS protection in older browsers
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Don't send referrer for cross-origin requests
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Limit browser features that the app doesn't need
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Allow the service worker and push notifications
          // Content-Security-Policy is intentionally permissive for a self-hosted
          // private app — tighten if you add a CDN or external scripts
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires inline scripts for hydration
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Allow Google Fonts (used by next/font)
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              // Push notifications connect to browser push services
              "connect-src 'self' https:",
              "worker-src 'self'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
