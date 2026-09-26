export function publicJson(data: object, maxAge = 300) {
    return Response.json(data, {
        headers: {
            "Cache-Control": ("fallback" in data && data.fallback) || ("stale" in data && data.stale)
                ? "no-store"
                : `public, max-age=60, s-maxage=${maxAge}, stale-while-revalidate=300`,
        },
    });
}
