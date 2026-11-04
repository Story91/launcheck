// Live smoke: runs the real pipeline twice (Dolphin primary, then SERV-only extraction) and prints timings/costs.
// Usage: pnpm --filter @tendr/core test:live [noticeId]   (reads ../../.env)
import { readFileSync } from "node:fs";
import { DolphinClient, DOLPHIN_DEFAULT_MODEL } from "../src/llm/dolphin";
import { ServClient } from "../src/llm/serv";
import { generateReport, type PipelineDeps, type ProgressStep } from "../src/pipeline/run";
import type { Report } from "../src/types";

function loadEnv(): void {
  try {
    for (const line of readFileSync(new URL("../../../.env", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env */
  }
}
loadEnv();

const noticeId = process.argv[2] ?? "722731-2026";
const servKey = process.env.SERV_API_KEY;
if (!servKey) {
  console.error("SERV_API_KEY missing in .env");
  process.exit(1);
}
const serv = new ServClient({ apiKey: servKey, baseUrl: process.env.SERV_BASE_URL });
const dolphin = process.env.DOLPHIN_API_KEY
  ? new DolphinClient({ apiKey: process.env.DOLPHIN_API_KEY, baseUrl: process.env.DOLPHIN_BASE_URL })
  : null;

const base: Omit<PipelineDeps, "dolphin"> = {
  serv,
  servModel: process.env.SERV_MODEL ?? "gpt-6-luna",
  fallbackModel: process.env.SERV_FALLBACK_MODEL ?? "gpt-5.4-mini",
  dolphinModel: process.env.DOLPHIN_MODEL ?? DOLPHIN_DEFAULT_MODEL,
};

async function run(label: string, deps: PipelineDeps): Promise<Report> {
  console.log(`\n═══ ${label} ═══`);
  const t0 = Date.now();
  let last = t0;
  const report = await generateReport(noticeId, deps, (step: ProgressStep, detail?: string) => {
    const now = Date.now();
    console.log(`  [${String(now - t0).padStart(6)} ms] ${step}${detail ? ` — ${detail}` : ""}  (+${now - last} ms)`);
    last = now;
  });
  console.log(`status: ${report.status}${report.error ? ` — ${report.error}` : ""}`);
  for (const a of report.audit) {
    console.log(
      `  ${a.step.padEnd(16)} ${a.model.padEnd(36)} ${String(a.durationMs).padStart(6)} ms  in/out ${a.usage.promptTokens}/${a.usage.completionTokens}  $${(a.costUsd ?? 0).toFixed(5)}  req ${a.requestId ?? "-"}${a.note ? `  note: ${a.note}` : ""}`,
    );
  }
  console.log(`risk ${report.riskScore}/100 · dropped evidence ${report.droppedEvidence} · cost $${report.costUsd.toFixed(4)}`);
  for (const s of report.signals.filter((x) => x.fired)) {
    console.log(`  🚩 ${s.id} [${s.severity}] ${s.reason}`);
    for (const e of s.evidence) console.log(`       „${e.slice(0, 160)}”`);
  }
  console.log(`summary: ${report.summary}`);
  return report;
}

const results: Report[] = [];
if (dolphin) results.push(await run("Dolphin primary extraction", { ...base, dolphin }));
else console.log("\n(no DOLPHIN_API_KEY → skipping Dolphin run)");
results.push(await run("SERV-only extraction (gemini-3.1-flash-lite)", { ...base, dolphin: null }));

if (results.some((r) => r.status === "failed")) process.exit(2);
