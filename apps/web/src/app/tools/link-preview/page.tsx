import Link from "next/link";
import { LinkPreviewBuilder } from "@/components/launchcheck/link-preview-builder";
import { experience } from "@/components/launchcheck/experience-copy";
import { copy } from "@/components/launchcheck/copy";
export const metadata = { title: `Link preview builder | ${copy.brand}`, description: experience.builder.intro };
export default function Page() {
  return <div><Link className="lc-text-link" href="/">{experience.builder.back}</Link><header className="lc-page-intro lc-builder-intro"><p className="lc-small">{experience.previewFree}</p><h1>{experience.builder.title}</h1><p>{experience.builder.intro}</p></header><LinkPreviewBuilder/></div>;
}
