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
    ]
  },
}

export default nextConfig
