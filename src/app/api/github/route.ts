import {failureCode, reportUpstream} from "@/lib/upstream";
import {getGithubProjects, unavailableGithubData} from "@/lib/github";
import {publicJson} from "@/lib/api-response";

export async function GET() {
    try {
        return publicJson(await getGithubProjects(), 600);
    } catch (error) {
        reportUpstream({service: "github", state: "degraded", reason: failureCode(error)});
        return publicJson(unavailableGithubData);
    }
}
