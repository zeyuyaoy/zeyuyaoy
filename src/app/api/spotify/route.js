import {spotifyService} from "@/lib/spotify";

export async function GET() {
    const result = await spotifyService.getStatus();

    return new Response(JSON.stringify(result.data), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            ...result.headers,
        },
    });
}
