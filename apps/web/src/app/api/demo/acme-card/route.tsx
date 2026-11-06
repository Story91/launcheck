import { ImageResponse } from "next/og";
import { copy } from "@/components/launchcheck/copy";
export function GET() {
  return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", justifyContent: "center", padding: 80, background: "#f3f6ef", color: "#203b33", fontFamily: "sans-serif" }}><strong style={{ fontSize: 32 }}>{copy.demoTitle}</strong><h1 style={{ fontSize: 80, lineHeight: 1.1, margin: "35px 0" }}>{copy.demoHeading}</h1><p style={{ fontSize: 30 }}>{copy.demoText}</p></div>, { width: 1200, height: 630 });
}
