import { describe, expect, spyOn, test } from "bun:test";
import {
  fetchHackclubNeighbors,
  hackclubFallback,
  hackclubHome,
  hackclubNeighbors,
  webrings,
} from "../src/lib/webrings";

describe("Hack Club webring navigation", () => {
  const members = [
    { url: "https://first.example/" },
    { url: "https://zeyuyaoy.com/" },
    { url: "http://last.example/about?webring=hackclub#hello" },
  ];

  test("finds neighbors by hostname and preserves destination query strings", () => {
    expect(hackclubNeighbors(members, "https://ZEYUYAOY.com/about")).toEqual({
      previousHref: members[0].url,
      nextHref: members[2].url,
    });
  });

  test("wraps both ends of the member list", () => {
    expect(hackclubNeighbors(members, members[0].url).previousHref).toBe(members[2].url);
    expect(hackclubNeighbors(members, members[2].url).nextHref).toBe(members[0].url);
  });

  test("matches the embed's first-member fallback for an unregistered site", () => {
    expect(hackclubNeighbors(members, "https://unregistered.example/")).toEqual({
      previousHref: members[2].url,
      nextHref: members[1].url,
    });
  });

  test("handles a one-member ring", () => {
    expect(hackclubNeighbors([{ url: "https://someone-else.example/" }])).toEqual({
      previousHref: "https://someone-else.example/",
      nextHref: "https://someone-else.example/",
    });
  });

  test.each(
    [
      null,
      [],
      [null],
      [{ url: "not a URL" }],
      [{ url: "javascript:alert(1)" }],
      [{ url: "https://username:password@example.com/" }],
    ].map((data) => [data]),
  )("rejects malformed or unsafe member data: %j", (data) => {
    expect(() => hackclubNeighbors(data)).toThrow();
  });

  test("fetches neighbors without cookies or Next.js server cache options", async () => {
    let request;
    const links = await fetchHackclubNeighbors(
      new AbortController().signal,
      async (url, options) => {
        request = { url, options };
        return Response.json(members);
      },
    );
    expect(request.url).toBe(`${hackclubHome}members.json`);
    expect(request.options.next).toBeUndefined();
    expect(request.options.credentials).toBe("omit");
    expect(request.options.signal).toBeInstanceOf(AbortSignal);
    expect(links.previousHref).toBe(members[0].url);
    expect(links.nextHref).toBe(members[2].url);
  });

  test("renders initial links synchronously without a network request", () => {
    const rings = webrings;
    expect(rings).toHaveLength(2);
    expect(rings[0].nextHref).toContain("to=next&name=zeyuyaoy");
    expect(rings[1].previousHref).toBe(hackclubHome);
    expect(rings[1].nextHref).toBe(hackclubHome);
  });

  test.each([
    ["HTTP error", async () => new Response(null, { status: 503 })],
    [
      "network error",
      async () => {
        throw new TypeError("Failed to fetch");
      },
    ],
    ["invalid JSON", async () => new Response("not JSON")],
    ["empty list", async () => Response.json([])],
    ["unsafe member", async () => Response.json([{ url: "javascript:alert(1)" }])],
  ])("retains directory links on %s", async (_name, fetchImpl) => {
    expect(await fetchHackclubNeighbors(new AbortController().signal, fetchImpl)).toEqual(
      hackclubFallback,
    );
  });

  const abortableFetch = async (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
      } else {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }
    });

  test("cancels the active fetch when the component unmounts", async () => {
    const controller = new AbortController();
    const pending = fetchHackclubNeighbors(controller.signal, abortableFetch);
    controller.abort();
    expect(await pending).toEqual(hackclubFallback);
  });

  test("retains directory links when the four-second deadline aborts the request", async () => {
    const deadline = new AbortController();
    const timeout = spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    try {
      const pending = fetchHackclubNeighbors(new AbortController().signal, abortableFetch);
      expect(timeout).toHaveBeenCalledWith(4000);
      deadline.abort(new DOMException("Timed out", "TimeoutError"));
      expect(await pending).toEqual(hackclubFallback);
    } finally {
      timeout.mockRestore();
    }
  });
});
