import { both, recordAudit, studentTarget } from "@/features/admin-system/mock-log";
import { AuditAction } from "@/features/admin-system/schema";
import { mockNameOf, requireMockOffice } from "@/features/auth/mock-token";
import { findMockAccountById } from "@/features/auth/mock-accounts";
import { findMockLine, localized, toLineSummary } from "@/features/lines/mock-builders";
import {
  crewWithViolations,
  saveViolations,
  violationsOf,
  type MockViolation,
} from "@/features/violations/mock-state";
import { toViolation, violationStatusOf } from "@/features/violations/mock";
import { ViolationStatus } from "@/features/violations/schema";
import { ServerErrorCode } from "@/lib/api/errors";
import { mockFileUrl } from "@/lib/api/mock/file-store";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { samplePhotoImage } from "@/lib/api/mock/sample-files";
import { Role } from "@/lib/auth/roles";
import {
  actOnViolationEndpoint,
  getDeskViolationEndpoint,
  listDeskViolationsEndpoint,
} from "./api";
import { ViolationDeskAction, ViolationDeskErrorCode, type DeskViolation } from "./schema";

const HTTP = { NotFound: 404, Conflict: 409, Unprocessable: 422 };
const DEFAULT_PAGE_SIZE = 20;
const READERS = [Role.StudentAffairs, Role.Transport];
const DECIDERS: readonly Role[] = [Role.StudentAffairs, Role.SuperAdmin];

const iso = (time: number) => new Date(time).toISOString();

interface Owned {
  crewId: string;
  item: MockViolation;
}

function allViolations(): Owned[] {
  return crewWithViolations().flatMap((crewId) =>
    violationsOf(crewId).map((item) => ({ crewId, item })),
  );
}

function findOwned(violationId: string): Owned {
  const found = allViolations().find(({ item }) => item.violationId === violationId);
  if (!found) {
    throw new MockHttpError(HTTP.NotFound, ServerErrorCode.NotFound, "No such violation.");
  }
  return found;
}

function allowedActions(role: Role, item: MockViolation): DeskViolation["allowed_actions"] {
  if (!DECIDERS.includes(role)) return [];
  const status = violationStatusOf(item);
  if (status === ViolationStatus.Closed) return [];
  return status === ViolationStatus.Submitted
    ? [ViolationDeskAction.Open, ViolationDeskAction.Close]
    : [ViolationDeskAction.Close];
}

function toDeskViolation({ crewId, item }: Owned, role: Role, language: string): DeskViolation {
  const reporter = findMockAccountById(crewId)?.user;
  const line = item.lineId ? findMockLine(item.lineId) : undefined;
  const name = (value: { ar: string; en: string } | null | undefined) =>
    value ? localized(language, value.ar, value.en) : null;
  const office = item.office;
  return {
    ...toViolation(item, language),
    reported_by: {
      name: reporter ? localized(language, reporter.name_ar ?? reporter.name, reporter.name) : "",
      role: reporter?.role === Role.Supervisor ? Role.Supervisor : Role.Driver,
    },
    line: line ? toLineSummary(line, language) : null,
    // A seeded violation's photo was never uploaded: it gets a sample picture.
    photo_url: mockFileUrl(item.violationId)?.url ?? samplePhotoImage(item.photoName),
    opened_by_name: name(office?.openedBy),
    decision:
      office?.closedAt !== null &&
      office?.closedAt !== undefined &&
      office.outcome &&
      office.closedBy
        ? {
            outcome: office.outcome,
            note: office.note ?? "",
            by_name: name(office.closedBy) ?? "",
            at: iso(office.closedAt),
          }
        : null,
    allowed_actions: allowedActions(role, item),
  };
}

const STATUS_ORDER: Record<ViolationStatus, number> = {
  [ViolationStatus.Submitted]: 0,
  [ViolationStatus.UnderReview]: 1,
  [ViolationStatus.Closed]: 2,
};

function byQueueOrder(a: Owned, b: Owned): number {
  const aStatus = violationStatusOf(a.item);
  const bStatus = violationStatusOf(b.item);
  if (aStatus !== bStatus) return STATUS_ORDER[aStatus] - STATUS_ORDER[bStatus];
  if (aStatus === ViolationStatus.Closed) {
    return (b.item.office?.closedAt ?? 0) - (a.item.office?.closedAt ?? 0);
  }
  return a.item.createdAt - b.item.createdAt;
}

function matchesSearch({ item }: Owned, q: string | undefined): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const student = item.student;
  return Boolean(
    student &&
    [student.identifier, student.nameAr, student.nameEn].some((value) =>
      value.toLowerCase().includes(needle),
    ),
  );
}

registerMock(listDeskViolationsEndpoint, ({ query }, { token, language }) => {
  const { user } = requireMockOffice(token, READERS);
  const scoped = allViolations().filter(
    (owned) => (!query.rule || owned.item.rule === query.rule) && matchesSearch(owned, query.q),
  );
  const counts = { submitted: 0, under_review: 0, closed: 0 };
  for (const { item } of scoped) counts[violationStatusOf(item)] += 1;
  const filtered = scoped
    .filter(({ item }) => !query.status || violationStatusOf(item) === query.status)
    .sort(byQueueOrder);
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? DEFAULT_PAGE_SIZE;
  return {
    items: filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map((owned) => toDeskViolation(owned, user.role, language)),
    total: filtered.length,
    counts,
  };
});

registerMock(getDeskViolationEndpoint, ({ params }, { token, language }) => {
  const { user } = requireMockOffice(token, READERS);
  return toDeskViolation(findOwned(params.violation_id), user.role, language);
});

registerMock(actOnViolationEndpoint, ({ params, body }, { token, language }) => {
  const officer = requireMockOffice(token, [Role.StudentAffairs]);
  const owned = findOwned(params.violation_id);
  const { item, crewId } = owned;
  if (violationStatusOf(item) === ViolationStatus.Closed) {
    throw new MockHttpError(
      HTTP.Conflict,
      ViolationDeskErrorCode.ViolationClosed,
      "Already closed.",
    );
  }
  const now = Date.now();
  const name = mockNameOf(officer);
  const opened = item.office ?? {
    openedAt: now,
    openedBy: name,
    closedAt: null,
    closedBy: null,
    outcome: null,
    note: null,
  };
  let office = opened;
  if (body.action === ViolationDeskAction.Close) {
    const note = body.note?.trim() ?? "";
    if (!body.outcome || !note) {
      throw new MockHttpError(
        HTTP.Unprocessable,
        ViolationDeskErrorCode.DecisionRequired,
        "Pick an outcome and write a note.",
      );
    }
    office = { ...opened, closedAt: now, closedBy: name, outcome: body.outcome, note };
  }
  const updated: MockViolation = { ...item, office };
  saveViolations(
    crewId,
    violationsOf(crewId).map((entry) => (entry.violationId === item.violationId ? updated : entry)),
  );
  recordAudit(
    officer,
    body.action === ViolationDeskAction.Close
      ? AuditAction.ViolationClosed
      : AuditAction.ViolationOpened,
    item.student ? studentTarget(item.student) : both(item.violationId),
    body.action === ViolationDeskAction.Close ? office.note : null,
    now,
  );
  return toDeskViolation({ crewId, item: updated }, officer.user.role, language);
});
