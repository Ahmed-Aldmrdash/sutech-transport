import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False in the server-rendered HTML and until React has taken over the page, then true. A form
 * shown before that would submit the browser's way (a GET with the fields in the URL), so its
 * submit button stays disabled until this is true.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
