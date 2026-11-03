import type { NoticeSummary } from "@tenderhound/core";
import Link from "next/link";

export function NoticeList({ notices }: { notices: NoticeSummary[] }) {
  if (notices.length === 0) return <p className="text-sm text-mist">TED returned no recent notices for this query. Paste a publication number above instead.</p>;
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {notices.map((n) => (
        <li key={n.noticeId} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6">
          <code className="shrink-0 text-sm text-mist">{n.noticeId}</code>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate">{n.buyer}</p>
            <p className="max-w-[80ch] text-base text-ink">{n.title.replace(/^[^–]*–[^–]*–\s*/, "")}</p>
            {n.deadline && <p className="text-xs text-mist">Tenders due {n.deadline.slice(0, 10)}</p>}
          </div>
          <Link href={`/report/${n.noticeId}`} className="shrink-0 text-sm text-tide underline-offset-2 hover:underline">
            Analyze
          </Link>
        </li>
      ))}
    </ul>
  );
}
