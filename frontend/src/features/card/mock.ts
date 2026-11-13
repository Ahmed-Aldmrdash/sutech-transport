import { findMockLine, localized, toLineSummary } from "@/features/lines/mock-builders";
import { mockTerm, requireMockStudent } from "@/features/subscriptions/mock";
import { bookingOnDate } from "@/features/requests/mock-riding-line";
import { MOCK_TERM } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { todayInCairo } from "@/lib/format";
import { getMyCardEndpoint } from "./api";
import { CardErrorCode } from "./schema";

const HTTP_FORBIDDEN = 403;
const QR_LIFETIME_MS = 30_000;

/** Looks like a signed token; the real server signs it (agreement, business rule 5). */
function mockQrToken(cardId: string, expiresAt: number): string {
  const payload = btoa(JSON.stringify({ card: cardId, exp: Math.floor(expiresAt / 1000) }));
  const signature = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `SUT1.${payload.replace(/=+$/, "")}.${signature}`;
}

registerMock(getMyCardEndpoint, (_input, { token, language }) => {
  const { user } = requireMockStudent(token);
  // Today's line: an approved temporary change shows on the card for its dates.
  const booking = bookingOnDate(user.id, todayInCairo());
  const line = booking && findMockLine(booking.lineId);
  if (!booking || !line || booking.status !== SubscriptionStatus.Active) {
    throw new MockHttpError(
      HTTP_FORBIDDEN,
      CardErrorCode.NotSubscribed,
      "The pass is for active subscribers only.",
    );
  }
  const [time, nameAr, nameEn] = line.stops[booking.stopOrder - 1] ?? [];
  const cardId = `card_${booking.subscriptionId}`;
  const expiresAt = Date.now() + QR_LIFETIME_MS;
  return {
    card_id: cardId,
    student: {
      name: localized(language, user.name_ar ?? user.name, user.name),
      identifier: user.identifier,
      faculty:
        localized(language, user.faculty_ar ?? user.faculty ?? "", user.faculty ?? "") || null,
      level: user.level ?? null,
      photo_url: null,
    },
    line: toLineSummary(line, language),
    stop: { name: localized(language, nameAr ?? "", nameEn ?? ""), pickup_time: time ?? null },
    term_name: mockTerm(language).name,
    valid_until: MOCK_TERM.ends_on,
    qr: { token: mockQrToken(cardId, expiresAt), expires_at: new Date(expiresAt).toISOString() },
  };
});
