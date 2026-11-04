import { defaultSearchQuery, searchNotices } from "@tendr/core";
import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET() {
  try {
    const notices = await searchNotices(defaultSearchQuery(), { limit: 12 });
    return NextResponse.json({ notices });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, notices: [] }, { status: 502 });
  }
}
