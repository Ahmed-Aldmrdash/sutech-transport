import { RequirePage } from "@/components/layout/RequirePage";
import { AdminPage } from "@/features/auth/permissions";
import { SecretaryGeneralScreen } from "@/features/overview/components/SecretaryGeneralScreen";

export default function Page() {
  return (
    <RequirePage page={AdminPage.SecretaryGeneral}>
      <SecretaryGeneralScreen />
    </RequirePage>
  );
}
