"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { LOGIN_PATH, homePathFor } from "../access";
import { SessionStatus } from "../session/session-store";
import { useSession } from "../session/use-session";
import { FullPageLoader } from "./full-page-loader";

export function StartRedirect() {
  const t = useTranslations("session");
  const router = useRouter();
  const state = useSession();

  useEffect(() => {
    if (state.status === SessionStatus.SignedIn)
      router.replace(homePathFor(state.session.user.role));
    else if (state.status === SessionStatus.SignedOut) router.replace(LOGIN_PATH);
  }, [state, router]);

  return <FullPageLoader label={t("checking")} />;
}
