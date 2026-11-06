import "server-only";
import { cache } from "react";
import { runStore } from "./run-store";
export const getDemoFixed = cache(async () => {
  try { return (await runStore().getSetting("demo_fixed")) === "true"; } catch { return false; }
});
