import { defaultSearchQuery, searchNotices, searchSamOpportunities, type NoticeSummary } from "@tendr/core";
import { NoticeForm } from "@/components/notice-form";
import { NoticeList } from "@/components/notice-list";

// SAM.gov personal API keys have a small daily request budget: refresh the list a few times a day only.
export const revalidate = 21600;

async function loadNotices(): Promise<{ source: "SAM.gov" | "TED"; notices: NoticeSummary[] }> {
  const apiKey = process.env.SAM_API_KEY;
  if (apiKey) {
    try {
      const notices = await searchSamOpportunities({ apiKey, limit: 5 });
      if (notices.length > 0) return { source: "SAM.gov", notices: notices.slice(0, 15) };
    } catch {
      /* fall back to TED below */
    }
  }
  try {
    return { source: "TED", notices: await searchNotices(defaultSearchQuery(), { limit: 12 }) };
  } catch {
    return { source: "TED", notices: [] };
  }
}

export default async function HomePage() {
  const { source, notices } = await loadNotices();
  return (
    <div className="space-y-12">
      <section className="max-w-[64ch]">
        <h1 className="text-4xl leading-tight">Read a public tender before you spend a week on it.</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate">
          Tendr reads a federal solicitation from SAM.gov, checks it against eight competition-restriction signals grounded in the FAR and shows you every quote it relies on, verbatim.
          Each report carries its full reasoning trail and an independent review.
        </p>
        <div className="mt-6">
          <NoticeForm />
        </div>
      </section>
      <section>
        {source === "SAM.gov" ? (
          <>
            <h2 className="text-2xl">Recent federal IT solicitations</h2>
            <p className="mb-4 mt-1 text-sm text-mist">Last 30 days on SAM.gov, NAICS 5415 and 5182. Pick one to generate its report.</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl">Recent IT notices on TED</h2>
            <p className="mb-4 mt-1 text-sm text-mist">EU notices, last 30 days, CPV 72. Pick one to generate its report.</p>
          </>
        )}
        <NoticeList notices={notices} />
      </section>
    </div>
  );
}
