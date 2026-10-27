/** @type {import('next').NextConfig} */
const nextConfig = {
  // GitHub Pages can serve only static files. The Pages workflow builds the
  // public restaurant site with its project-repository URL prefix.
  ...(process.env.GITHUB_PAGES === "true"
    ? {
        output: "export",
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
        trailingSlash: true,
      }
    : {}),
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  images: {
    unoptimized: process.env.GITHUB_PAGES === "true",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  ...(process.env.GITHUB_PAGES === "true"
    ? {}
    : {
        async headers() {
          return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
          ];
        },
      }),
};
module.exports = nextConfig;
