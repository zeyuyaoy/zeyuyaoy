import {describe, expect, test} from "bun:test";
import {getGithubProjects} from "../src/lib/github";
import {publicJson} from "../src/lib/api-response";

describe("GitHub server data", () => {
    test("preserves public API fields with a bounded, revalidated request", async () => {
        let options;
        const projects = await getGithubProjects(async (_url, init) => {
            options = init;
            return Response.json([{
                name: "portfolio",
                html_url: "https://github.com/example/portfolio",
                description: "A project",
                language: "JavaScript",
                stargazers_count: 3,
                forks_count: 2,
                private: false,
            }]);
        });
        expect(projects).toEqual([{
            name: "portfolio",
            url: "https://github.com/example/portfolio",
            description: "A project",
            language: "JavaScript",
            stars: 3,
            forks: 2,
        }]);
        expect(options.next.revalidate).toBe(600);
        expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    test("rejects upstream failures instead of caching them as projects", async () => {
        await expect(getGithubProjects(async () => new Response("unavailable", {status: 503})))
            .rejects.toThrow("HTTP 503");
    });

    test.each([{projects: []}, [null], [{name: "unsafe", html_url: "javascript:alert(1)"}], [{
        name: "unsafe",
        html_url: "https://github.com.evil.example/repo"
    }],].map(data => [data]))("rejects malformed data and unsafe project URLs: %j", async (data) => {
        await expect(getGithubProjects(async () => Response.json(data))).rejects.toThrow();
    });
});

describe("public API caching", () => {
    test("allows shared caching of successful public data", async () => {
        const response = publicJson({forecast: "clear skies"}, 900);
        expect(response.headers.get("cache-control")).toContain("s-maxage=900");
        expect(await response.json()).toEqual({forecast: "clear skies"});
    });

    test("does not cache an unavailable upstream response", () => {
        expect(publicJson({fallback: true}).headers.get("cache-control")).toBe("no-store");
    });
});
