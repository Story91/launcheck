import { homeImage } from "@/components/launchcheck/home-og";
import { copy } from "@/components/launchcheck/copy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = copy.lede;
export default function Image() { return homeImage(); }
