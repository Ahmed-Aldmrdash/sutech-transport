import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next.js internals, the service worker and static files.
  matcher: ["/((?!api|_next|_vercel|serwist|.*\\..*).*)"],
};
