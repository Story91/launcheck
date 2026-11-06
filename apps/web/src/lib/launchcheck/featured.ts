import "server-only";
import { launchCheckReportSchema } from "@tendr/core/launchcheck/types";
import { runStore } from "./run-store";
export async function featuredReport() {
  try {
    const id = await runStore().getSetting("featured_report"); if (!id) return null;
    const stored = await runStore().getReport(id);
    const result = launchCheckReportSchema.safeParse(stored);
    return result.success && result.data.status === "done" ? { ...result.data, isRequester: false } : null;
  } catch { return null; }
}
