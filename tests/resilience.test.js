import {describe, expect, test} from "bun:test";
import {createCachedUpstream, failureCode, trustedHttpsUrl, UpstreamError} from "../src/lib/upstream";
import {parseWeather} from "../src/lib/weather";
import {publicJson} from "../src/lib/api-response";

function cacheFixture(load) {
    let time = 0;
    const events = [];
    const get = createCachedUpstream({
        service: "test", load, freshMs: 10, staleMs: 100, retryMs: 20,
        fallback: {fallback: true}, now: () => time, report: event => events.push(event)
    });
    return {
        get, events, at(value) {
            time = value;
        }
    };
}

describe("bounded upstream resilience", () => {
    test("shares concurrent requests and caches only validated successes", async () => {
        let calls = 0;
        const fixture = cacheFixture(async () => {
            calls++;
            return {forecast: "clear skies"};
        });

        const results = await Promise.all([fixture.get(), fixture.get(), fixture.get()]);
        expect(calls).toBe(1);
        expect(results[0]).toEqual(results[2]);

        await fixture.get();
        expect(calls).toBe(1);
    });

    test("bounds stale age even during backoff and recovers without extending stale lifetime", async () => {
        let broken = false;
        let calls = 0;
        const fixture = cacheFixture(async () => {
            calls++;
            if (broken) throw new UpstreamError("http_error", 503);
            return {forecast: "clear skies"};
        });

        await fixture.get();
        broken = true;
        fixture.at(90);

        const stale = await fixture.get();
        expect(stale.stale).toBe(true);
        expect(publicJson(stale).headers.get("cache-control")).toBe("no-store");

        fixture.at(101);
        expect((await fixture.get()).fallback).toBe(true);
        expect(calls).toBe(2);

        fixture.at(111);
        await fixture.get();
        expect(fixture.events).toHaveLength(1);
        broken = false;

        fixture.at(132);
        expect(await fixture.get()).toEqual({forecast: "clear skies"});
        expect(fixture.events.at(-1)).toEqual({service: "test", state: "recovered"});
    });

    test("handles synchronous exceptions and retries instead of retaining a resolved promise", async () => {
        let broken = true;
        const fixture = cacheFixture(() => {
            if (broken) throw new Error("secret upstream body");
            return Promise.resolve({ok: true});
        });
        expect((await fixture.get()).fallback).toBe(true);

        fixture.at(21);
        broken = false;
        expect(await fixture.get()).toEqual({ok: true});
        expect(JSON.stringify(fixture.events)).not.toContain("secret");
    });

    test.each([
        [new DOMException("request timed out", "TimeoutError"), "timeout"],
        [new DOMException("request aborted", "AbortError"), "timeout"],
        [new SyntaxError("secret JSON payload"), "invalid_response"],
        [new Error("token=secret"), "network_error"],
    ])("classifies failures without exposing exception text: %s", async (error, reason) => {
        const fixture = cacheFixture(async () => {
            throw error;
        });
        expect(failureCode(error)).toBe(reason);

        const result = await fixture.get();
        expect(result).toEqual({fallback: true, reason});
        expect(publicJson(result).headers.get("cache-control")).toBe("no-store");
        expect(JSON.stringify(fixture.events)).not.toContain("secret");
    });
});

const weather = forecasts => ({data: {items: [{forecasts}]}});
describe("weather contract", () => {
    test("uses configured location or most common forecast", () => {
        const payload = weather([{area: "A", forecast: "Fair (Day)"}, {area: "B", forecast: "Rain"}, {
            area: "C",
            forecast: "Rain"
        }]);
        expect(parseWeather(payload, "A")).toEqual({forecast: "clear skies"});
        expect(parseWeather(payload, "unknown")).toEqual({forecast: "rain"});
    });

    test.each([null, {}, {data: {}}, weather([]), weather([null]), weather([{
        area: "A",
        forecast: {}
    }]), weather([{area: "A", forecast: " "}])].map(value => [value]))("rejects malformed forecast data %j", value => {
        expect(() => parseWeather(value)).toThrow("invalid_response");
    });

    test("counts arbitrary strings without prototype collisions", () => {
        expect(parseWeather(weather([{area: "A", forecast: "__proto__"}]))).toEqual({forecast: "__proto__"});
    });
});

describe("trusted HTTPS URLs", () => {
    test("accepts a URL on the trusted host", () => {
        expect(trustedHttpsUrl("https://github.com/zeyuyaoy", "github.com")).toBe(true);
    });

    test.each(["javascript:alert(1)", "http://github.com/p", "https://github.com.evil.test/p", "https://user:pass@github.com/p", "https://github.com:444/p"])("rejects unsafe URLs %s", url => {
        expect(trustedHttpsUrl(url, "github.com")).toBe(false);
    });
});
