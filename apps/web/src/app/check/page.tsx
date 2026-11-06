import { CheckForm } from "@/components/launchcheck/check-form";
import { copy } from "@/components/launchcheck/copy";
export const metadata = { title: `${copy.start} | ${copy.brand}`, robots: { index: false, follow: true } };
export default async function CheckPage({ searchParams }: { searchParams: Promise<{ url?: string; fixture?: string }> }) { const params = await searchParams; return <div><div className="lc-page-intro"><h1>{copy.start}</h1><p>{copy.lede}</p></div><CheckForm initialUrl={params.url} fixture={params.fixture === "1"}/></div>; }
