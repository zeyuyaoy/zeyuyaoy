import {trustedHttpsUrl, UpstreamError} from "./upstream";

export interface Project {
    name: string;
    description: string | null;
    url: string;
    stars: number;
}

export async function getGithubProjects(fetchImpl = fetch): Promise<Project[]> {
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    const response = await fetchImpl(
        "https://api.github.com/users/zeyuyaoy/repos?type=owner&sort=updated&per_page=100",
        {
            headers: {
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                ...(token ? {Authorization: `Bearer ${token}`} : {}),
            },
            next: {revalidate: 600},
            signal: AbortSignal.timeout(8000),
        },
    );

    if (!response.ok) {
        throw new UpstreamError("http_error", response.status);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
        throw new UpstreamError("invalid_response");
    }

    return data.map((item: unknown) => {
        if (!item || typeof item !== "object"
            || !("name" in item) || typeof item.name !== "string"
            || !("html_url" in item) || typeof item.html_url !== "string"
            || !("stargazers_count" in item) || typeof item.stargazers_count !== "number"
            || !Number.isSafeInteger(item.stargazers_count) || item.stargazers_count < 0
            || !item.name.trim() || !trustedHttpsUrl(item.html_url, "github.com")) {
            throw new UpstreamError("invalid_response");
        }

        return {
            name: item.name,
            url: item.html_url,
            stars: item.stargazers_count,
            description: "description" in item && typeof item.description === "string" ? item.description : null,
        };
    });
}
