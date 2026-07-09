/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb"
    }
  },
  // Juur (/) sõltub hostist:
  //  - mell*.vercel.app  → uus süsteem (/app.html)
  //  - kõik muu (muugiassistent-online) → vana CRM (/crm.html), et Rauli süsteem ei muutuks.
  async redirects() {
    return [
      { source: "/", has: [{ type: "host", value: "mell.*" }], destination: "/app.html", permanent: false },
      { source: "/", destination: "/crm.html", permanent: false }
    ];
  }
};

export default nextConfig;
