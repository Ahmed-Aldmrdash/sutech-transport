import { LineDetail } from "@/features/lines/components/LineDetail";

export default async function Page({ params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await params;
  return <LineDetail lineId={lineId} />;
}
