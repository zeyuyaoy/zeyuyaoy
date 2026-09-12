/** @type {import('next').NextConfig} */
const cachedApiRoutes = [
    '/api/github',
    '/api/photos',
    '/api/profile-pic',
    '/api/weather',
];

const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "i.scdn.co",
            },
            {
                protocol: "https",
                hostname: "slack.cytronicoder.com",
            },
        ],
        formats: ['image/webp', 'image/avif'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        minimumCacheTTL: 60 * 60 * 24 * 365,
        qualities: [75, 85, 90],
    },
    experimental: {
        optimizePackageImports: ['date-fns', 'lodash'],
    },
    compress: true,

    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin',
                    },
                ],
            },
            ...cachedApiRoutes.map((source) => ({
                source,
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=60, stale-while-revalidate=300',
                    },
                ],
            })),
        ];
    },
};

export default nextConfig;
