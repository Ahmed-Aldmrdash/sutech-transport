/**
 * Writes a first-party cookie the app itself reads (role hint, login step). Never a secret:
 * the session credential is the server's HttpOnly cookie. `Secure` is added on https, which is
 * every deployed build; plain http is only localhost.
 */
export function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${Math.max(0, maxAgeSeconds)}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
