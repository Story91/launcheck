import Link from "next/link";
import { copy } from "@/components/launchcheck/copy";
export default function MissingReport() { return <div className="lc-page-error"><h1>{copy.api.missing}</h1><p>{copy.notFoundBody}</p><Link className="lc-button" href="/">{copy.start}</Link></div>; }
