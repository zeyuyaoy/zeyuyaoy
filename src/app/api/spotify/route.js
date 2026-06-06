import querystring from "querystring";

const {
    SPOTIFY_CLIENT_ID: client_id,
    SPOTIFY_CLIENT_SECRET: client_secret,
    SPOTIFY_REFRESH_TOKEN: refresh_token,
} = process.env;

const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");

const NOW_PLAYING_ENDPOINT = `https://api.spotify.com/v1/me/player/currently-playing`;
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`;

let cachedSpotifyData = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30 * 1000;

const unavailableData = {
    isPlaying: false,
    fallback: true,
    reason: "unavailable",
    title: "Spotify status unavailable",
    message: "Music status is unavailable right now.",
};

const premiumRequiredData = {
    ...unavailableData,
    reason: "limited_access",
};

const getAccessToken = async () => {
    const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: querystring.stringify({
            grant_type: "refresh_token",
            refresh_token,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch access token: ${response.statusText}`);
    }

    return response.json();
};

const getNowPlaying = async (access_token) => {
    const response = await fetch(NOW_PLAYING_ENDPOINT, {
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });

    return response;
};

export async function GET() {
    try {
        const now = Date.now();
        if (cachedSpotifyData && (now - cacheTimestamp) < CACHE_DURATION) {
            return new Response(JSON.stringify(cachedSpotifyData), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        const { access_token } = await getAccessToken();
        const response = await getNowPlaying(access_token);

        if (response.status === 204) {
            const notPlayingData = { isPlaying: false };
            cachedSpotifyData = notPlayingData;
            cacheTimestamp = now;

            return new Response(
                JSON.stringify(notPlayingData),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        if (response.status === 403) {
            cachedSpotifyData = premiumRequiredData;
            cacheTimestamp = now;

            return new Response(
                JSON.stringify(premiumRequiredData),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        if (!response.ok) {
            cachedSpotifyData = unavailableData;
            cacheTimestamp = now;

            return new Response(
                JSON.stringify(unavailableData),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const song = await response.json();
        const isPlaying = song.is_playing;
        const title = song.item.name;
        const artist = song.item.artists
            .map((artist) => artist.name)
            .join(", ")
            .replace(/,(?!.*,)/gim, " and");
        const album = song.item.album.name;
        const albumImageUrl = song.item.album.images[0].url;
        const songUrl = song.item.external_urls.spotify;

        const songData = {
            album,
            albumImageUrl,
            artist,
            isPlaying,
            songUrl,
            title,
        };

        cachedSpotifyData = songData;
        cacheTimestamp = now;

        return new Response(
            JSON.stringify(songData),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error fetching currently playing song:", error);

        if (cachedSpotifyData) {
            console.log("Spotify API error, serving cached data");
            return new Response(JSON.stringify(cachedSpotifyData), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (error.status === 429) {
            return new Response(
                JSON.stringify({
                    ...unavailableData,
                    reason: "rate_limited",
                    message: "Music status is unavailable right now.",
                    isPlaying: false,
                    fallback: true
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        return new Response(
            JSON.stringify(unavailableData),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
