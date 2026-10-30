import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminAnnouncementsScreen } from "@/features/announcements/components/AdminAnnouncementsScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Announcements}>
      <AdminAnnouncementsScreen />
    </RequirePage>
  );
}
