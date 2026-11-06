import { Gallery } from "@/components/launchcheck/gallery";
import { copy } from "@/components/launchcheck/copy";
export const metadata = { title: `${copy.gallery} | ${copy.brand}`, description: copy.galleryLede };
export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ fixture?: string }> }) { return <><div className="lc-page-intro"><h1>{copy.galleryTitle}</h1><p>{copy.galleryLede}</p></div><Gallery fixture={(await searchParams).fixture === "1"}/></>; }
