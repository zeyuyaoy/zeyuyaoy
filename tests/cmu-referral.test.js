import { describe, expect, it, mock } from "bun:test";
import { createCmuReferralReporter, getCmuReferralDetection } from "@/lib/cmu-referral";

const tagged = "?utm_source=cmu&utm_medium=referral&utm_campaign=andrew_userweb";
const andrew = "https://www.andrew.cmu.edu/user/example/";

describe("Andrew UserWeb attribution", () => {
  it.each([
    [tagged, "", "utm"],
    ["", andrew, "referrer"],
    ["", "https://andrew.cmu.edu/", "referrer"],
    ["", "http://www.andrew.cmu.edu/", "referrer"],
    [tagged, andrew, "utm+referrer"],
    ["?utm_source=cmu", "", null],
    ["?utm_source=cmu", andrew, "referrer"],
    ["?utm_source=linkedin&utm_medium=social", "", null],
    ["", "", null],
    ["", "https://www.cmu.edu/", null],
    ["", "https://cs.cmu.edu/", null],
    ["", "https://other.andrew.cmu.edu/", null],
    ["", "https://www.andrew.cmu.edu.attacker.example/", null],
    ["", "https://attacker.example/?ref=www.andrew.cmu.edu", null],
    ["", "https://www.andrew.cmu.edu@attacker.example/", null],
    ["", "https://user@www.andrew.cmu.edu/", null],
    ["", "ftp://www.andrew.cmu.edu/", null],
    ["", "not a URL", null],
    ["", "https://[invalid", null],
    [tagged, "not a URL", "utm"],
    [`${tagged}&utm_source=linkedin`, "", null],
    [tagged.replace("andrew_userweb", "other_campaign"), "", null],
    [`${tagged}&email=private%40example.com`, "", "utm"],
  ])("detects only canonical tags or Andrew hosts (%s, %s)", (search, referrer, expected) => {
    expect(getCmuReferralDetection(search, referrer)).toBe(expected);
  });
});

function sessionStorageStub() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

describe("CMU landing event deduplication", () => {
  it("reports once across repeated callbacks, query changes, and client navigation", () => {
    const storage = sessionStorageStub();
    const report = mock();
    const reportLanding = createCmuReferralReporter();

    reportLanding(tagged, andrew, () => storage, report);
    reportLanding(tagged, andrew, () => storage, report);
    reportLanding(`${tagged}&extra=value`, "", () => storage, report);
    reportLanding("", andrew, () => storage, report);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith("utm+referrer");
    expect([...storage.values.values()]).toEqual(["1"]);
  });

  it("deduplicates a new document in the same session but permits a fresh session", () => {
    const storage = sessionStorageStub();
    const report = mock();
    createCmuReferralReporter()(tagged, "", () => storage, report);
    createCmuReferralReporter()(tagged, "", () => storage, report);
    expect(report).toHaveBeenCalledTimes(1);

    createCmuReferralReporter()(tagged, "", () => sessionStorageStub(), report);
    expect(report).toHaveBeenCalledTimes(2);
  });

  it("does not attribute tags added after a non-CMU landing", () => {
    const storage = sessionStorageStub();
    const report = mock();
    const reportLanding = createCmuReferralReporter();
    reportLanding("", "", () => storage, report);
    reportLanding(tagged, "", () => storage, report);
    expect(report).not.toHaveBeenCalled();
    expect(storage.values.size).toBe(0);
  });

  it.each(["access", "read", "write"])("still deduplicates when storage %s throws", (failure) => {
    const fail = () => {
      throw new Error("Storage unavailable");
    };

    const getStorage =
      failure === "access"
        ? fail
        : () => ({
            getItem: failure === "read" ? fail : () => null,
            setItem: fail,
          });

    const report = mock();
    const reportLanding = createCmuReferralReporter();

    expect(() => {
      reportLanding(tagged, "", getStorage, report);
      reportLanding(tagged, "", getStorage, report);
    }).not.toThrow();

    expect(report).toHaveBeenCalledTimes(1);
  });
});
