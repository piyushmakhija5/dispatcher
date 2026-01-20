/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features if needed
  experimental: {
    // serverActions: true, // Already stable in Next.js 14
  },

  // Environment variables that should be available on the client
  env: {
    // Add any build-time env vars here if needed
  },
};

export default nextConfig;
