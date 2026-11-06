import { getPublicReport } from "@/components/launchcheck/server";
import { reportImage } from "@/components/launchcheck/og";
import { copy } from "@/components/launchcheck/copy";
export const dynamic = "force-dynamic";
export const alt = copy.ogTitle;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image({ params }: { params: Promise<{ id: string }> }) { const result = await getPublicReport((await params).id); return reportImage(result.kind === "ok" ? result.report : null); }
