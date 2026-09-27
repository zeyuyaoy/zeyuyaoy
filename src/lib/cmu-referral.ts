type CmuReferralDetection = "utm" | "referrer" | "utm+referrer";

export function getCmuReferralDetection(
  search: string,
  referrer: string,
): CmuReferralDetection | null {
  const params = new URLSearchParams(search);
  const tagged = [
    ["utm_source", "cmu"],
    ["utm_medium", "referral"],
    ["utm_campaign", "andrew_userweb"],
  ].every(([key, value]) => {
    const values = params.getAll(key);
    return values.length === 1 && values[0] === value;
  });

  let fromAndrew = false;
  try {
    const url = new URL(referrer);
    fromAndrew =
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      (url.hostname === "andrew.cmu.edu" || url.hostname === "www.andrew.cmu.edu");
  } catch {}

  if (tagged && fromAndrew) {
    return "utm+referrer";
  }

  if (tagged) {
    return "utm";
  }

  return fromAndrew ? "referrer" : null;
}

const sessionKey = "cmu-referral-reported";

export function createCmuReferralReporter() {
  let landingChecked = false;

  return (
    search: string,
    referrer: string,
    getStorage: () => Pick<Storage, "getItem" | "setItem">,
    report: (detection: CmuReferralDetection) => void,
  ) => {
    if (landingChecked) {
      return;
    }

    landingChecked = true;
    const detection = getCmuReferralDetection(search, referrer);
    if (!detection) {
      return;
    }

    try {
      const storage = getStorage();
      if (storage.getItem(sessionKey)) {
        return;
      }
      storage.setItem(sessionKey, "1");
    } catch {}

    report(detection);
  };
}
