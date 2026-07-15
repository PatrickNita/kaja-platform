"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type WelcomeIntroProps = {
  memberName: string;
  memberSlug: string;
};

export function WelcomeIntro({ memberName, memberSlug }: WelcomeIntroProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const key = `kaja-welcome:${memberSlug}`;
    if (window.sessionStorage.getItem(key)) return;

    window.sessionStorage.setItem(key, "shown");
    setVisible(true);
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1600);
    const closeTimer = window.setTimeout(() => setVisible(false), 2000);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(closeTimer);
    };
  }, [memberSlug]);

  if (!visible) return null;

  return (
    <div className={`welcome-intro${leaving ? " welcome-intro--leaving" : ""}`} aria-live="polite" aria-label={`Welcome, ${memberName}`}>
      <div className="welcome-intro__content">
        <Image className="welcome-intro__logo" src="/kaja-logo.png" alt="KAJA" width={1024} height={240} priority />
        <p>Welcome, {memberName}</p>
      </div>
    </div>
  );
}
