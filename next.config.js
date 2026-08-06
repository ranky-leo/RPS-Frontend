/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
  async rewrites() {
    return [
      {
        source: "/:refer([0-9a-fA-F-]{32,40})",
        destination: "/?refer=:refer",
      },
    ];
  },
};

module.exports = nextConfig;
