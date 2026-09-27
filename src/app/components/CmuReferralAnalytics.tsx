"use client";

import {Analytics} from "@vercel/analytics/next";
import {type BeforeSendEvent, track} from "@vercel/analytics";
import {createCmuReferralReporter} from "@/lib/cmu-referral";

const reportLanding = createCmuReferralReporter();

function beforeSend(event: BeforeSendEvent): BeforeSendEvent {
  if (event.type === "pageview") {
    reportLanding(
      new URL(event.url).search,
      document.referrer,
      () => window.sessionStorage,
      (detection) => {
        queueMicrotask(() => {
          track("CMU Referral", {campaign: "andrew_userweb", detection});
        });
      },
    );
  }

  return event;
}

export default function CmuReferralAnalytics() {
  return (
    <Analytics
      beforeSend={
        process.env.NEXT_PUBLIC_CMU_REFERRAL_EVENTS_ENABLED === "true" ? beforeSend : undefined
      }
    />
  );
}
