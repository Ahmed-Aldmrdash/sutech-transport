import { registerMock } from "@/lib/api/mock/mock-server";
import { getHealthEndpoint } from "./api";
import { ServiceStatus } from "./schema";

const MOCK_SERVER_VERSION = "mock-0.1.0";

registerMock(getHealthEndpoint, () => ({
  status: ServiceStatus.Ok,
  version: MOCK_SERVER_VERSION,
  server_time: new Date().toISOString(),
}));
