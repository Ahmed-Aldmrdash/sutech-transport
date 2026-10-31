import { today } from "../clock";
import { me } from "../helpers";
import { dayRecordView, requestView } from "../views";
import { requireChild } from "./day";
import type { Handlers } from "./types";

export const parentHandlers: Handlers = {
  "GET /parent/children/{student_id}/timeline": (ctx) => {
    const studentId = ctx.params.student_id!;
    requireChild(ctx, studentId);
    return dayRecordView(ctx.db, studentId, ctx.query.date ?? today(), ctx);
  },
  "GET /parent/requests": (ctx) => {
    const children = me(ctx).children;
    const items = ctx.db.requests.filter((row) => children.includes(row.student_id)).map((row) => requestView(ctx.db, row, ctx));
    return { items, total: items.length };
  },
};
