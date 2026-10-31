import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { AdminPaymentsScreen } from "@/features/payments/components/AdminPaymentsScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.Payments}>
      <AdminPaymentsScreen />
    </RequirePage>
  );
}
