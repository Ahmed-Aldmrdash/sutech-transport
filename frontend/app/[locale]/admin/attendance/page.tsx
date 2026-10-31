import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminAttendanceScreen } from "@/features/attendance/components/AdminAttendanceScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Attendance}>
      <AdminAttendanceScreen />
    </RequirePage>
  );
}
