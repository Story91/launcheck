// GAO evaluation set: runs the production analysis path (analyzeNotice, US/FAR rules) on solicitation text quoted in
// GAO bid-protest decisions, N times per case, and scores per-signal precision/recall and run-to-run stability.
// Usage: pnpm --filter @tendr/core eval [--runs 3] [--concurrency 4] [--only B-421234,B-422000]   (reads ../../.env)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ServClient } from "../src/llm/serv";
import { scoreEval, type EvalCaseResult, type EvalMetrics } from "../src/eval/metrics";
import { analyzeNotice, type PipelineDeps } from "../src/pipeline/run";
import type { FlatNotice } from "../src/ted/flatten";

interface GaoCase {
  id: string;
  title: string | null;
  date: string | null;
  url: string;
  sourceType: string;
  agency: string | null;
  solicitationNumber: string | null;
  outcome: string;
  group: "positive" | "negative";
  ground: string;
  excerpts: string[];
  expectedSignals: string[];
  labelNote: string;
}

interface RunRecord {
  caseId: string;
  run: number;
  status: string;
  error: string | null;
  fired: { id: string; severity: string; reason: string; evidence: string[] }[];
  costUsd: number;
  durationMs: number;
  notes: string[];
}

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

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Same line format as the SAM.gov flattener, so extraction sees what a live US notice looks like. No GAO outcome leaks in. */
export function caseToNotice(c: GaoCase): FlatNotice {
  const lines = ["type: Solicitation"];
  if (c.agency) lines.push(`fullParentPathName: ${c.agency}`);
  if (c.solicitationNumber) lines.push(`solicitationNumber: ${c.solicitationNumber}`);
  for (const e of c.excerpts) for (const l of e.split("\n")) if (l.trim()) lines.push(`description: ${l.trim()}`);
  return { text: lines.join("\n"), language: "ENG", buyerPlatform: c.url };
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
  }));
}

const pct = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)}%`);

function markdown(m: EvalMetrics, cases: GaoCase[], records: RunRecord[], runs: number, model: string, startedAt: string): string {
  const cost = records.reduce((s, r) => s + r.costUsd, 0);
  const byId = new Map(cases.map((c) => [c.id, c]));
  const signals = [...new Set(m.cases.flatMap((c) => [...c.expected, ...c.predicted]))].sort();
  const out = [
    `# GAO evaluation set: results`,
    ``,
    `Run ${startedAt} · ${cases.length} cases · ${runs} runs each · model ${model} (fallback per pipeline) · total cost $${cost.toFixed(4)}`,
    ``,
    `Ground truth: GAO bid-protest decisions. Positives are protests GAO sustained because a solicitation term restricted competition; negatives are protests on unrelated grounds whose decisions quote ordinary solicitation text. Input is only the solicitation language the decision quotes, formatted like a SAM.gov notice; the GAO outcome is never shown to the model. A signal counts as predicted when it fired (after the verbatim-evidence check) in at least half of the runs.`,
    ``,
    `| Metric | Value |`,
    `|---|---|`,
    `| Precision (per signal) | ${pct(m.precision)} (${m.tp} TP, ${m.fp} FP) |`,
    `| Recall (per signal) | ${pct(m.recall)} (${m.fn} FN) |`,
    `| Sustained protests caught | ${m.positivesCaught} of ${m.positives} |`,
    `| Clean notices with a false alarm | ${m.negativesFlagged} of ${m.negatives} |`,
    `| Run-to-run stability | ${pct(m.stability)} |`,
    `| Failed runs | ${m.failedRuns} |`,
    ``,
    `## Per signal`,
    ``,
    `| Signal | TP | FP | FN |`,
    `|---|---|---|---|`,
    ...signals.map((s) => `| ${s} | ${m.cases.filter((c) => c.truePositives.includes(s)).length} | ${m.cases.filter((c) => c.falsePositives.includes(s)).length} | ${m.cases.filter((c) => c.falseNegatives.includes(s)).length} |`),
    ``,
    `## Per case`,
    ``,
    `| Case | Group | Expected | Predicted | Stability | Source |`,
    `|---|---|---|---|---|---|`,
    ...m.cases.map((c) => `| ${c.id} | ${c.group} | ${c.expected.join(", ") || "none"} | ${c.predicted.join(", ") || "none"} | ${pct(c.stability)} (${c.completedRuns}/${runs}) | [${byId.get(c.id)?.sourceType ?? "link"}](${byId.get(c.id)?.url}) |`),
    ``,
    `## Misses and false alarms`,
    ``,
  ];
  for (const c of m.cases.filter((x) => x.falseNegatives.length || x.falsePositives.length)) {
    const gc = byId.get(c.id);
    out.push(`### ${c.id} (${c.group})`, ``, `GAO: ${gc?.ground ?? ""}`, ``);
    if (c.falseNegatives.length) out.push(`Missed: ${c.falseNegatives.join(", ")}. Label note: ${gc?.labelNote ?? ""}`, ``);
    for (const s of c.falsePositives) {
      const example = records.find((r) => r.caseId === c.id && r.fired.some((f) => f.id === s))?.fired.find((f) => f.id === s);
      out.push(`Unexpected ${s}: ${example?.reason ?? ""}`, ``);
    }
  }
  return out.join("\n");
}

async function main(): Promise<void> {
  loadEnv();
  const servKey = process.env.SERV_API_KEY;
  if (!servKey) throw new Error("SERV_API_KEY missing in .env");
  const runs = Number(arg("runs") ?? 3);
  const concurrency = Number(arg("concurrency") ?? 4);
  const only = arg("only")?.split(",");
  const all = (JSON.parse(readFileSync(new URL("../eval/gao-cases.json", import.meta.url), "utf8")) as { cases: GaoCase[] }).cases;
  const cases = only ? all.filter((c) => only.includes(c.id)) : all;

  const deps: PipelineDeps = {
    serv: new ServClient({ apiKey: servKey, baseUrl: process.env.SERV_BASE_URL }),
    dolphin: null,
    servModel: process.env.SERV_MODEL ?? "gpt-6-luna",
    fallbackModel: process.env.SERV_FALLBACK_MODEL ?? "gpt-5.4-mini",
    extractModel: process.env.SERV_EXTRACT_MODEL,
  };

  const startedAt = new Date().toISOString();
  const stamp = startedAt.slice(0, 16).replace(/[:T]/g, "-");
  const outDir = new URL("../eval/results/", import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const records: RunRecord[] = [];
  const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ({ c, run })));
  console.log(`${cases.length} cases × ${runs} runs = ${jobs.length} pipeline runs (concurrency ${concurrency})`);

  await pool(jobs, concurrency, async ({ c, run }) => {
    const t0 = Date.now();
    const report = await analyzeNotice(`gao-${c.id}`, caseToNotice(c), "US", deps, { summary: false });
    const fired = report.signals.filter((s) => s.fired).map((s) => ({ id: s.id, severity: s.severity, reason: s.reason, evidence: s.evidence }));
    records.push({
      caseId: c.id,
      run,
      status: report.status,
      error: report.error,
      fired,
      costUsd: report.costUsd,
      durationMs: Date.now() - t0,
      notes: report.audit.filter((a) => a.note).map((a) => `${a.step}: ${a.note}`),
    });
    writeFileSync(new URL(`gao-${stamp}.runs.json`, outDir), JSON.stringify(records, null, 2));
    console.log(`  ${c.id} #${run + 1} ${report.status} [${fired.map((f) => f.id).join(", ") || "none"}] expected [${c.expectedSignals.join(", ") || "none"}] ${((Date.now() - t0) / 1000).toFixed(0)}s $${report.costUsd.toFixed(4)}`);
  });

  const results: EvalCaseResult[] = cases.map((c) => ({
    id: c.id,
    group: c.group,
    expected: c.expectedSignals,
    runs: Array.from({ length: runs }, (_, run) => {
      const r = records.find((x) => x.caseId === c.id && x.run === run);
      return r && r.status !== "failed" ? r.fired.map((f) => f.id) : null;
    }),
  }));
  const metrics = scoreEval(results);
  writeFileSync(new URL(`gao-${stamp}.metrics.json`, outDir), JSON.stringify(metrics, null, 2));
  const md = markdown(metrics, cases, records, runs, deps.servModel, startedAt);
  writeFileSync(new URL(`gao-${stamp}.md`, outDir), md);
  writeFileSync(new URL("LATEST.md", outDir), md);
  console.log(`\nprecision ${pct(metrics.precision)} · recall ${pct(metrics.recall)} · caught ${metrics.positivesCaught}/${metrics.positives} · false alarms ${metrics.negativesFlagged}/${metrics.negatives} · stability ${pct(metrics.stability)} · failed ${metrics.failedRuns}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
