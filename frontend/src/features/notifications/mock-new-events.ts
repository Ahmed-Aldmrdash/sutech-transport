import { firstNameOf } from "@/features/auth/user-text";
import { bookingWindowOf } from "@/features/booking-window/mock-state";
import { BookingWindowAction } from "@/features/booking-window/schema";
import { mockChildrenOf } from "@/features/children/mock-links";
import {
  crewDriverIdOf,
  crewTripsOn,
  homeLineIdOf,
  supervisorIdsOf,
} from "@/features/crew/mock-state";
import { disciplineOf } from "@/features/discipline/mock-state";
import { DisciplineAction } from "@/features/discipline/schema";
import { findMockLine, localized } from "@/features/lines/mock-builders";
import { lineDriverId, mockFleetBus } from "@/features/lines/mock-fleet";
import { bookingOf } from "@/features/subscriptions/mock-state";
import { SubscriptionStatus } from "@/features/subscriptions/schema";
import { TripDirection } from "@/features/trips/schema";
import { cairoNow } from "@/lib/api/mock/cairo-clock";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { NotificationKind, NotificationTarget, type AppNotification } from "./schema";

/**
 * The mock's notifications for what the review of 2026-11-16 added: the crew hears about a
 * move to another bus and about the other crew member starting or ending the trip; students
 * and guardians hear about warnings, suspensions and bans; students without a seat hear when
 * booking opens or is extended.
 */
type Draft = Omit<AppNotification, "read_at">;

// ---------------------------------------------------------------------------------------------
// Bus crew

/** To a driver: the office sent them to another line's bus, or gave their bus to someone else. */
function driverMoves(userId: string, language: string, now: number): Draft[] {
  const driverId = crewDriverIdOf(userId);
  if (!driverId) return [];
  const date = cairoNow(new Date(now)).date;
  const home = homeLineIdOf(driverId);
  return crewTripsOn(date).flatMap((trip) => {
    const line = findMockLine(trip.lineId);
    if (!line) return [];
    return (trip.replacements ?? []).flatMap((replacement): Draft[] => {
      const bus = mockFleetBus(replacement.busId);
      const plate = bus?.plate ?? "";
      if (replacement.driverId === driverId && trip.lineId !== home) {
        return [
          {
            notification_id: `ntf_assign_${replacement.replacementId}`,
            kind: NotificationKind.CrewAssignment,
            title: localized(
              language,
              `مكتب النقل نقلك لخط ${line.code} النهارده`,
              `You're on line ${line.code} today`,
            ),
            body: localized(
              language,
              `هتسوق أتوبيس ${plate}. افتح الرحلة عشان تشوف المحطات والطلاب.`,
              `You'll drive bus ${plate}. Open the trip to see its stops and students.`,
            ),
            created_at: new Date(replacement.at).toISOString(),
            link: { target: NotificationTarget.Home, id: null },
          },
        ];
      }
      if (trip.lineId === home && replacement.driverId !== driverId) {
        return [
          {
            notification_id: `ntf_relieved_${replacement.replacementId}`,
            kind: NotificationKind.CrewAssignment,
            title: localized(
              language,
              `رحلة خط ${line.code} راحت لسواق تاني`,
              `Line ${line.code}'s trip went to another driver`,
            ),
            body: localized(
              language,
              "مكتب النقل هيكلمك لو محتاجك على أتوبيس تاني النهارده.",
              "The Transportation office will call you if it needs you on another bus today.",
            ),
            created_at: new Date(replacement.at).toISOString(),
            link: { target: NotificationTarget.Home, id: null },
          },
        ];
      }
      return [];
    });
  });
}

/** To the driver and supervisor: the other one started or ended a trip of their bus. */
function crewPresses(userId: string, language: string, now: number): Draft[] {
  const date = cairoNow(new Date(now)).date;
  const driverId = crewDriverIdOf(userId);
  return crewTripsOn(date).flatMap((trip): Draft[] => {
    const line = findMockLine(trip.lineId);
    if (!line) return [];
    const onThisBus = driverId
      ? (trip.replacements?.at(-1)?.driverId ?? lineDriverId(trip.lineId)) === driverId
      : supervisorIdsOf(trip.lineId).includes(userId);
    if (!onThisBus) return [];
    const way =
      trip.direction === TripDirection.Outbound
        ? { ar: "رحلة الصبح", en: "The morning trip" }
        : { ar: "رحلة العودة", en: "The return trip" };
    const drafts: Draft[] = [];
    if (trip.startedAt !== null && trip.startedBy && trip.startedBy !== userId) {
      drafts.push({
        notification_id: `ntf_start_${trip.tripId}`,
        kind: NotificationKind.TripStarted,
        title: localized(language, `${way.ar} بدأت`, `${way.en} started`),
        body: localized(
          language,
          "زميلك على الأتوبيس بدأها. مش محتاج تدوس بدء.",
          "Your crew mate on the bus started it. No need to press start.",
        ),
        created_at: new Date(trip.startedAt).toISOString(),
        link: { target: NotificationTarget.Home, id: null },
      });
    }
    if (trip.endedAt !== null && trip.endedBy && trip.endedBy !== userId) {
      drafts.push({
        notification_id: `ntf_end_${trip.tripId}`,
        kind: NotificationKind.TripStarted,
        title: localized(language, `${way.ar} خلصت`, `${way.en} ended`),
        body: localized(
          language,
          "زميلك على الأتوبيس قفلها.",
          "Your crew mate on the bus ended it.",
        ),
        created_at: new Date(trip.endedAt).toISOString(),
        link: { target: NotificationTarget.Home, id: null },
      });
    }
    return drafts;
  });
}

export function crewNotifications(userId: string, language: string, now: number): Draft[] {
  return [...driverMoves(userId, language, now), ...crewPresses(userId, language, now)];
}

// ---------------------------------------------------------------------------------------------
// Discipline

const ACTION_TEXT: Record<DisciplineAction, { ar: string; en: string }> = {
  [DisciplineAction.Warning]: { ar: "إنذار", en: "a warning" },
  [DisciplineAction.Suspension]: {
    ar: "إيقاف مؤقت عن الأتوبيسات",
    en: "a suspension from the buses",
  },
  [DisciplineAction.Ban]: { ar: "حظر من الأتوبيسات", en: "a ban from the buses" },
};

function disciplineDrafts(
  studentId: string,
  language: string,
  who: { ar: string; en: string } | null,
  suffix: string,
  link: AppNotification["link"],
): Draft[] {
  return disciplineOf(studentId).flatMap((record): Draft[] => {
    const what = ACTION_TEXT[record.action];
    const until = record.endsOn
      ? {
          ar: ` لحد ${formatCalendarDate(record.endsOn, "ar")}`,
          en: ` until ${formatCalendarDate(record.endsOn, "en")}`,
        }
      : { ar: "", en: "" };
    const drafts: Draft[] = [
      {
        notification_id: `ntf_dsc_${record.recordId}${suffix}`,
        kind: NotificationKind.Discipline,
        title: who
          ? localized(
              language,
              `${who.ar} خد ${what.ar}${until.ar}`,
              `${who.en} got ${what.en}${until.en}`,
            )
          : localized(language, `إنت خدت ${what.ar}${until.ar}`, `You got ${what.en}${until.en}`),
        body: localized(
          language,
          `السبب: ${record.reason}. لو عندك سؤال، كلّم مكتب النقل أو شؤون الطلاب.`,
          `Reason: ${record.reason}. Questions go to the Transportation office or Student Affairs.`,
        ),
        created_at: new Date(record.createdAt).toISOString(),
        link,
      },
    ];
    if (record.liftedAt !== null) {
      drafts.push({
        notification_id: `ntf_dsc_lift_${record.recordId}${suffix}`,
        kind: NotificationKind.Discipline,
        title: who
          ? localized(
              language,
              `اترفع ${what.ar} عن ${who.ar}`,
              `${who.en}'s ${what.en.replace(/^an? /, "")} was lifted`,
            )
          : localized(
              language,
              `اترفع ${what.ar} عنك`,
              `Your ${what.en.replace(/^an? /, "")} was lifted`,
            ),
        body: localized(
          language,
          "تقدر تركب الأتوبيس عادي من النهارده.",
          "You can ride the bus as usual from today.",
        ),
        created_at: new Date(record.liftedAt).toISOString(),
        link,
      });
    }
    return drafts;
  });
}

export function studentDisciplineNotifications(studentId: string, language: string): Draft[] {
  return disciplineDrafts(studentId, language, null, "", {
    target: NotificationTarget.Home,
    id: null,
  });
}

export function guardianDisciplineNotifications(guardianId: string, language: string): Draft[] {
  return mockChildrenOf(guardianId).flatMap(({ user }) =>
    disciplineDrafts(
      user.id,
      language,
      { ar: firstNameOf(user.name_ar ?? user.name), en: firstNameOf(user.name) },
      `_${guardianId}`,
      { target: NotificationTarget.ChildDay, id: user.id },
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// Booking window

/** To students without a live booking: booking opened or was extended. */
export function bookingWindowNotifications(studentId: string, language: string): Draft[] {
  const booking = bookingOf(studentId);
  const hasSeat =
    booking !== undefined &&
    booking.status !== SubscriptionStatus.Expired &&
    booking.status !== SubscriptionStatus.Cancelled;
  if (hasSeat) return [];
  return bookingWindowOf()
    .history.filter(
      (change) =>
        (change.action === BookingWindowAction.Open ||
          change.action === BookingWindowAction.Extend) &&
        change.closesAt !== null,
    )
    .map((change) => {
      const until = new Date(change.closesAt ?? 0).toISOString();
      const extended = change.action === BookingWindowAction.Extend;
      return {
        notification_id: `ntf_bw_${change.at}`,
        kind: NotificationKind.BookingWindow,
        title: extended
          ? localized(language, "مكتب النقل مدّ الحجز", "Booking was extended")
          : localized(language, "الحجز فتح", "Booking is open"),
        body: localized(
          language,
          `احجز كرسيك قبل ${formatDateTime(until, "ar")}. بعدها الحجز بيقفل حتى لو فيه أماكن.`,
          `Book your seat before ${formatDateTime(until, "en")}. After that booking closes, even with free seats.`,
        ),
        created_at: new Date(change.at).toISOString(),
        link: { target: NotificationTarget.Lines, id: null },
      };
    });
}
