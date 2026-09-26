import {spotifyService} from "@/lib/spotify";

export async function GET() {
    const result = await spotifyService.getStatus();
    return Response.json(result.data, {headers: result.headers});
}
