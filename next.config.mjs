/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb"
    }
  },
  // Juur (/) → päris CRM (/crm.html). Vana Next.js avaleht on pargitud — ära näita seda enam.
  async redirects() {
    return [
      { source: "/", destination: "/crm.html", permanent: false }
    ];
  }
};

export default nextConfig;
