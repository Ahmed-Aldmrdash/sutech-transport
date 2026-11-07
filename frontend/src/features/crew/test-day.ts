/**
 * Test mode only: on a Friday, a Saturday or a holiday the crew's page offers "try a test
 * day", which makes today a service day for the mock server, so the pages can be tried any
 * day. The real server never sees this key.
 */
export const TEST_DAY_KEY = "sut.mock.crewTestDay";

export function startTestDay(date: string): void {
  try {
    localStorage.setItem(TEST_DAY_KEY, date);
  } catch {
    // Private mode: no test day.
  }
}

export function isTestDay(date: string): boolean {
  try {
    return localStorage.getItem(TEST_DAY_KEY) === date;
  } catch {
    return false;
  }
}
