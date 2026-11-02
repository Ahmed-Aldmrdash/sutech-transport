import { seatsHeldOn } from "@/features/subscriptions/mock-state";
import { MockHttpError, registerMock } from "@/lib/api/mock/mock-server";
import { requireMockAccount } from "@/features/auth/mock-token";
import { getLineEndpoint, listLinesEndpoint } from "./api";
import { findMockLine, toLine, toLineDetail } from "./mock-builders";
import { MOCK_LINES } from "./mock-lines";
import { LineErrorCode } from "./schema";

const HTTP_NOT_FOUND = 404;

registerMock(listLinesEndpoint, (_input, { token, language }) => {
  requireMockAccount(token);
  return MOCK_LINES.map((line) => toLine(line, language, seatsHeldOn(line.lineId)));
});

registerMock(getLineEndpoint, ({ params }, { token, language }) => {
  requireMockAccount(token);
  const line = findMockLine(params.line_id);
  if (!line) throw new MockHttpError(HTTP_NOT_FOUND, LineErrorCode.LineNotFound, "No such line.");
  return toLineDetail(line, language, seatsHeldOn(line.lineId));
});
