import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { BusCompanyScreen } from "@/features/events/components/BusCompanyScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.BusCompany}>
      <BusCompanyScreen />
    </RequirePage>
  );
}
