import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { UsersScreen } from "@/features/overview/components/UsersScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Users}>
      <UsersScreen />
    </RequirePage>
  );
}
