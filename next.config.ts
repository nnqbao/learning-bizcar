import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  typescript: { ignoreBuildErrors: false },
  experimental: {
    serverActions: { bodySizeLimit: "22mb" },
  },
  // Security headers on every response. No CSP yet: lesson files run their own scripts (new Function).
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ],
    }];
  },
  async redirects() {
    return [
      { source: "/learn/course/bmdo-k03/lesson/04/vrim", destination: "/learn/course/bmdo-k03/lesson/04", permanent: false },
      { source: "/learn/course/bmdo-k03/lesson/04/vrim/:path*", destination: "/learn/course/bmdo-k03/lesson/04", permanent: false },
    ];
  },
};

export default nextConfig;
