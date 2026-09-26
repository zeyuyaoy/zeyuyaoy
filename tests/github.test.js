import {describe, expect, test} from "bun:test";
import {getGithubProjects} from "../src/lib/github";

describe("GitHub server data", () => {
    test("returns only displayed project fields with a bounded, revalidated request", async () => {
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
