import { isValidNoticeId } from "@tendr/core";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report-view";
import { publicView } from "@/lib/reports";
import { reportStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidNoticeId(id)) notFound();
  const stored = await reportStore().get(id);
  return <ReportView noticeId={id} initial={stored ? publicView(stored) : null} />;
}
