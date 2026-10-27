import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  async redirects() {
    // /p/{id} is the one canonical post URL and /l/{id} the listing's. Old shapes redirect (query strings are kept).
    return [
      { source: "/listing/:id(\\d+)", destination: "/l/:id", permanent: true },
      { source: "/marketplace/:id(\\d+)", destination: "/l/:id", permanent: true },
      { source: "/posts/:id(\\d+)", destination: "/p/:id", permanent: true },
      { source: "/read/:id(\\d+)", destination: "/p/:id", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // The worker script itself must never be served from a stale HTTP cache, or updates won't roll out.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    // Pin to this project (a stray package-lock.json exists in $HOME).
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
