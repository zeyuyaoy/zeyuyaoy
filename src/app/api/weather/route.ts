import {publicJson} from "@/lib/api-response";
import {getWeather} from "@/lib/weather";

export async function GET() {
    return publicJson(await getWeather(), 900);
}
