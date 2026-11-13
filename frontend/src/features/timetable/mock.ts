import { recordAudit } from "@/features/admin-system/mock-log";
import { AuditAction } from "@/features/admin-system/schema";
import { mockNameOf, requireMockOffice } from "@/features/auth/mock-token";
import {
  MOCK_CAMPUS_ARRIVAL,
  findMockLine,
  localized,
  toLineSummary,
} from "@/features/lines/mock-builders";
import { MOCK_LINES } from "@/features/lines/mock-lines";
import {
  MOCK_DEFAULT_RETURN_TIME,
  mockReturnChange,
  mockReturnTime,
  saveMockReturnTime,
} from "@/features/lines/mock-timetable";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { Role } from "@/lib/auth/roles";
import { changeReturnTimeEndpoint, getTimetableEndpoint } from "./api";
import { TimetableErrorCode, isReturnTimeAllowed, type Timetable } from "./schema";

const TRANSPORT = [Role.Transport];

/** "16:30" → "4:30 PM" / "4:30 م", for a log line stored once in both languages. */
function clock12(clock: string): { ar: string; en: string } {
  const [hours = 0, minutes = 0] = clock.split(":").map(Number);
  const time = `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, "0")}`;
  const morning = hours < 12;
  return { ar: `${time} ${morning ? "ص" : "م"}`, en: `${time} ${morning ? "AM" : "PM"}` };
}
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;

function timetable(language: string): Timetable {
  return {
    default_return_time: MOCK_DEFAULT_RETURN_TIME,
    items: MOCK_LINES.map((line) => {
      const change = mockReturnChange(line.lineId);
      return {
        line: toLineSummary(line, language),
        stop_count: line.stops.length,
        first_pickup_time: line.stops[0]?.[0] ?? null,
        campus_arrival: MOCK_CAMPUS_ARRIVAL,
        return_departure_time: mockReturnTime(line.lineId),
        changed_by_name: change ? localized(language, change.byName.ar, change.byName.en) : null,
        changed_at: change ? new Date(change.at).toISOString() : null,
      };
    }),
  };
}

registerMock(getTimetableEndpoint, (_input, { token, language }) => {
  requireMockOffice(token, TRANSPORT);
  return timetable(language);
});

registerMock(changeReturnTimeEndpoint, ({ body }, { token, language }) => {
  const account = requireMockOffice(token, TRANSPORT);
  if (!isReturnTimeAllowed(body.return_departure_time)) {
    throw new MockHttpError(
      HTTP_UNPROCESSABLE,
      TimetableErrorCode.ReturnTimeOutOfRange,
      "The buses leave campus from 12:00 to 20:00.",
    );
  }
  const lines =
    body.line_ids.length === 0
      ? MOCK_LINES
      : body.line_ids.map((lineId) => {
          const line = findMockLine(lineId);
          if (!line) {
            throw new MockHttpError(HTTP_NOT_FOUND, TimetableErrorCode.LineNotFound, "No line.");
          }
          return line;
        });
  const time = body.return_departure_time;
  const change = { time, byName: mockNameOf(account), at: Date.now() };
  for (const line of lines) saveMockReturnTime(line.lineId, change);
  const clock = clock12(time);
  const target =
    body.line_ids.length === 0
      ? { ar: `كل الخطوط · العودة ${clock.ar}`, en: `Every line · leaves campus ${clock.en}` }
      : {
          ar: `${lines.map((line) => `خط ${line.code}`).join("، ")} · العودة ${clock.ar}`,
          en: `${lines.map((line) => `Line ${line.code}`).join(", ")} · leaves campus ${clock.en}`,
        };
  recordAudit(account, AuditAction.ReturnTimeChanged, target);
  return timetable(language);
});
