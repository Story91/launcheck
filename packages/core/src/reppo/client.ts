import type { ReppoVerdict } from "../types";

export const REPPO_BASE_URL = "https://eval.reppo.xyz/api/v1";

export class ReppoBusyError extends Error {
  constructor() {
    super("Reppo: another evaluation is pending for this account");
    this.name = "ReppoBusyError";
  }
}

export class ReppoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ReppoError";
  }
}

export interface ReppoSubmitInput {
  payload: string;
  context: string;
  criteria: string[];
  settlementMinutes: 10 | 15 | 30 | 60 | 120 | 360 | 720 | 1440;
}

export interface ReppoClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Sends `Sandbox: true` → free placeholder verdict, not stored. */
  sandbox: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

interface ReppoEvalResponse {
  evalId?: string;
  id?: string;
  status?: "PENDING" | "SETTLED" | "FAILED";
  result?: {
    verdict?: { score?: number; decision?: "accept" | "revise" | "reject"; confidence?: string };
    verdicts?: { criterion?: string; score?: number; critique?: string }[];
    evidence?: { evidenceBasis?: string };
  };
}

export class ReppoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  /** Public so callers can tag verdicts that came from the free sandbox lane. */
  readonly sandbox: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(opts: ReppoClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? REPPO_BASE_URL).replace(/\/$/, "");
    this.sandbox = opts.sandbox;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => new Date());
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...(this.sandbox ? { Sandbox: "true" } : {}),
    };
  }

  async submit(input: ReppoSubmitInput): Promise<{ evalId: string }> {
    const res = await this.fetchImpl(`${this.baseUrl}/agents/eval-requests/submit`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ type: "artifact", ...input }),
    });
    if (res.status === 409) throw new ReppoBusyError();
    const json = (await res.json().catch(() => ({}))) as ReppoEvalResponse & { error?: string };
    if (!res.ok) throw new ReppoError(json.error ?? `Reppo submit failed: HTTP ${res.status}`, res.status);
    const evalId = json.evalId ?? json.id;
    if (!evalId) throw new ReppoError("Reppo submit returned no evalId", res.status);
    return { evalId };
  }

  async get(evalId: string): Promise<ReppoVerdict> {
    const res = await this.fetchImpl(`${this.baseUrl}/agents/eval-requests/${encodeURIComponent(evalId)}`, {
      headers: this.headers(),
    });
    const json = (await res.json().catch(() => ({}))) as ReppoEvalResponse & { error?: string };
    if (!res.ok) throw new ReppoError(json.error ?? `Reppo get failed: HTTP ${res.status}`, res.status);
    const status = json.status ?? "PENDING";
    const verdict = json.result?.verdict;
    const critiques = (json.result?.verdicts ?? []).map((v) => v.critique).filter((c): c is string => !!c);
    const nowIso = this.now().toISOString();
    return {
      evalId: json.evalId ?? json.id ?? evalId,
      status,
      score: verdict?.score ?? null,
      decision: verdict?.decision ?? null,
      confidence: verdict?.confidence ?? null,
      critique: critiques.length ? critiques.join(" | ") : null,
      evidenceBasis: json.result?.evidence?.evidenceBasis ?? null,
      submittedAt: nowIso,
      settledAt: status === "PENDING" ? null : nowIso,
    };
  }
}
