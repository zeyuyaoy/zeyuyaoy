const WEATHER_API_ENDPOINT = `https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast`;

let cachedWeatherData = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 15 * 60 * 1000;

const unavailableWeatherData = {
    forecast: "unavailable",
    fallback: true,
    message: "Weather is unavailable right now.",
};

const getWeatherData = async () => {
    const response = await fetch(WEATHER_API_ENDPOINT);

    if (!response.ok) {
        throw new Error(`Failed to fetch weather data: ${response.statusText}`);
    }

    return response.json();
};

const getConversationalForecast = (forecast) => {
    const lowerCaseForecast = forecast.toLowerCase();
    if (lowerCaseForecast.includes("fair")) {
        return "clear skies";
    }
    return lowerCaseForecast;
};

export async function GET() {
    try {
        const now = Date.now();
        if (cachedWeatherData && (now - cacheTimestamp) < CACHE_DURATION) {
            return new Response(JSON.stringify(cachedWeatherData), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        const data = await getWeatherData();

        if (!data || !data.data || !data.data.items || !data.data.items[0] || !data.data.items[0].forecasts) {
            if (cachedWeatherData) {
                console.log("Weather API returned no data, serving cached data");
                return new Response(JSON.stringify(cachedWeatherData), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            return new Response(
                JSON.stringify(unavailableWeatherData),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const location = process.env.WEATHER_LOCATION;
        const forecasts = data.data.items[0].forecasts;
        let forecastToUse;

        if (location) {
            const specificForecast = forecasts.find(f => f.area === location);
            if (specificForecast) {
                forecastToUse = specificForecast.forecast;
            }
        }

        if (!forecastToUse) {
            const forecastCounts = forecasts.reduce((acc, item) => {
                acc[item.forecast] = (acc[item.forecast] || 0) + 1;
                return acc;
            }, {});

            forecastToUse = Object.keys(forecastCounts).reduce((a, b) =>
                forecastCounts[a] > forecastCounts[b] ? a : b
            );
        }

        if (!forecastToUse) {
            if (cachedWeatherData) {
                console.log("No forecast found, serving cached data");
                return new Response(JSON.stringify(cachedWeatherData), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            return new Response(
                JSON.stringify(unavailableWeatherData),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const weatherData = {
            forecast: getConversationalForecast(forecastToUse),
        };

        cachedWeatherData = weatherData;
        cacheTimestamp = now;

        return new Response(
            JSON.stringify(weatherData),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error fetching weather data:", error);

        if (cachedWeatherData) {
            console.log("Weather API error, serving cached data");
            return new Response(JSON.stringify(cachedWeatherData), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (error.status === 429) {
            return new Response(
                JSON.stringify({
                    ...unavailableWeatherData,
                    reason: "rate_limited",
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        return new Response(
            JSON.stringify(unavailableWeatherData),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
