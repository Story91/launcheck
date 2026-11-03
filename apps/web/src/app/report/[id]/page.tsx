import { isValidNoticeId } from "@tenderhound/core";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report-view";
import { reportStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidNoticeId(id)) notFound();
  const initial = await reportStore().get(id);
  return <ReportView noticeId={id} initial={initial} />;
}
