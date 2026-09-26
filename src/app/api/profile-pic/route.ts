import {publicJson} from "@/lib/api-response";
import {getProfileImage} from "@/lib/profile-image";

export async function GET() {
    return publicJson(await getProfileImage());
}
