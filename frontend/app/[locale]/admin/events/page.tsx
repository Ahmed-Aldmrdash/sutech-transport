import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { EventsScreen } from "@/features/events/components/EventsScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Events}>
      <EventsScreen />
    </RequirePage>
  );
}
