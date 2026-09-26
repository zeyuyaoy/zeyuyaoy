/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {root: process.cwd()},
    outputFileTracingRoot: process.cwd(),
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "i.scdn.co",
            },
        ],
        formats: ['image/webp', 'image/avif'],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        minimumCacheTTL: 60 * 60,
        qualities: [75, 90],
    },

    async redirects() {
        return ["cytronicoder\\.com", "www\\.cytronicoder\\.com", "www\\.zeyuyaoy\\.com"].map(host => ({
            source: "/:path*",
            has: [{type: "host", value: host}],
            destination: "https://zeyuyaoy.com/:path*",
            permanent: true,
        }));
    },

    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: "base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src-attr 'none'",
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
