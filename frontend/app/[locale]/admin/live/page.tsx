import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { LiveScreen } from "@/features/tracking/components/LiveScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Live}>
      <LiveScreen />
    </RequirePage>
  );
}
