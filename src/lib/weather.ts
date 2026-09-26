import {createCachedUpstream, isRecord, UpstreamError} from "./upstream";

export function parseWeather(data: unknown, location?: string): { forecast: string } {
    const items = isRecord(data) && isRecord(data.data) ? data.data.items : undefined;
    const forecasts: unknown = Array.isArray(items) && isRecord(items[0]) ? items[0].forecasts : undefined;
    if (!Array.isArray(forecasts) || !forecasts.length) {
        throw new UpstreamError("invalid_response");
    }

    const validated = forecasts.map((item: unknown) => {
        if (!isRecord(item) || typeof item.area !== "string" || !item.area.trim()
            || typeof item.forecast !== "string" || !item.forecast.trim()) {
            throw new UpstreamError("invalid_response");
        }
        return {area: item.area, forecast: item.forecast};
    });

    let forecast = validated.find(item => item.area === location)?.forecast;
    if (!forecast) {
        const counts = new Map<string, number>();
        for (const item of validated) counts.set(item.forecast, (counts.get(item.forecast) ?? 0) + 1);
        forecast = [...counts.keys()].reduce((a, b) => (counts.get(a) ?? 0) > (counts.get(b) ?? 0) ? a : b);
    }

    const normalized = forecast.toLowerCase();
    return {forecast: normalized.includes("fair") ? "clear skies" : normalized};
}

export const getWeather = createCachedUpstream({
    service: "weather", freshMs: 15 * 60_000, staleMs: 60 * 60_000,
    fallback: {forecast: "unavailable", fallback: true, message: "Weather is unavailable right now."},
    load: async () => {
        const response = await fetch("https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast", {
            signal: AbortSignal.timeout(8000), cache: "no-store",
        });

        if (!response.ok) {
            throw new UpstreamError("http_error", response.status);
        }

        return parseWeather(await response.json(), process.env.WEATHER_LOCATION);
    },
});
