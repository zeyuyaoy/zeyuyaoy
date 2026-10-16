/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.1.3"],
  devIndicators: { position: "top-right" },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.md": {
        loaders: ["./scripts/profile-markdown-loader.cjs"],
        as: "*.js",
      },
    },
  },
  outputFileTracingRoot: process.cwd(),
  images: {
    localPatterns: [
      { pathname: "/_next/static/media/**", search: "" },
      { pathname: "/_next/static/immutable/media/**", search: "" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
        port: "",
        pathname: "/image/**",
        search: "",
      },
    ],
    formats: ["image/webp"],
    deviceSizes: [640],
    imageSizes: [64, 96, 128, 256, 384],
    minimumCacheTTL: 2678400,
    qualities: [75, 90],
  },

  async redirects() {
    return ["cytronicoder\\.com", "www\\.cytronicoder\\.com", "www\\.zeyuyaoy\\.com"].map(
      (host) => ({
        source: "/:path*",
        has: [{ type: "host", value: host }],
        destination: "https://zeyuyaoy.com/:path*",
        permanent: true,
      }),
    );
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src-attr 'none'",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
