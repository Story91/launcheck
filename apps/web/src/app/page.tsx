import { defaultSearchQuery, searchNotices, type NoticeSummary } from "@tenderhound/core";
import { NoticeForm } from "@/components/notice-form";
import { NoticeList } from "@/components/notice-list";

export const revalidate = 3600;

export default async function HomePage() {
  let notices: NoticeSummary[] = [];
  try {
    notices = await searchNotices(defaultSearchQuery(), { limit: 12 });
  } catch {
    notices = [];
  }
  return (
    <div className="space-y-12">
      <section className="max-w-[64ch]">
        <h1 className="text-4xl leading-tight">Read a public tender before you spend a week on it.</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate">
          TenderHound reads a TED notice, checks it against eight competition-restriction signals and shows you every quote it relies on, verbatim.
          Each report carries its full reasoning trail and an independent review.
        </p>
        <div className="mt-6">
          <NoticeForm />
        </div>
      </section>
      <section>
        <h2 className="text-2xl">Recent IT notices with performance in Poland</h2>
        <p className="mb-4 mt-1 text-sm text-mist">Last 30 days on TED, CPV 72. Pick one to generate its report.</p>
        <NoticeList notices={notices} />
      </section>
    </div>
  );
}
