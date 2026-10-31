import { Suspense } from "react";
import { MyRequestsScreen } from "@/features/requests/components/MyRequestsScreen";

export default function Page() {
  return (
    <Suspense>
      <MyRequestsScreen />
    </Suspense>
  );
}
