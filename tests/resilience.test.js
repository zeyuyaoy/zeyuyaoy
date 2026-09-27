import {describe, expect, test} from "bun:test";
import {failureCode, trustedHttpsUrl, UpstreamError} from "../src/lib/upstream";

describe("upstream failure classification", () => {
  test.each([
    [new UpstreamError("http_error", 503), "http_error"],
    [new DOMException("request timed out", "TimeoutError"), "timeout"],
    [new DOMException("request aborted", "AbortError"), "timeout"],
    [new SyntaxError("secret JSON payload"), "invalid_response"],
    [new Error("token=secret"), "network_error"],
  ])("classifies failures without exposing exception text: %s", (error, reason) => {
    expect(failureCode(error)).toBe(reason);
  });
});

describe("trusted HTTPS URLs", () => {
  test("accepts a URL on the trusted host", () => {
    expect(trustedHttpsUrl("https://github.com/zeyuyaoy", "github.com")).toBe(true);
  });

  test.each([
    "javascript:alert(1)",
    "http://github.com/p",
    "https://github.com.evil.test/p",
    "https://user:pass@github.com/p",
    "https://github.com:444/p",
  ])("rejects unsafe URLs %s", (url) => {
    expect(trustedHttpsUrl(url, "github.com")).toBe(false);
  });
});
