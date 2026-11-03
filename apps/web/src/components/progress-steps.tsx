const STEPS: { key: string; label: string }[] = [
  { key: "ingest", label: "Fetching the notice from TED" },
  { key: "extract", label: "Extracting facts" },
  { key: "signals", label: "Evaluating eight signals (three SERV calls)" },
  { key: "verify", label: "Checking every quote against the source" },
  { key: "summary", label: "Writing the summary" },
];

export function ProgressSteps({ progress }: { progress: string | null }) {
  const idx = STEPS.findIndex((s) => s.key === progress);
  return (
    <ol className="space-y-2 text-sm" aria-live="polite">
      {STEPS.map((s, i) => {
        const state = idx === -1 && progress === "done" ? "done" : i < idx ? "done" : i === idx ? "active" : "todo";
        return (
          <li key={s.key} className={state === "todo" ? "text-mist" : state === "active" ? "text-ink" : "text-moss"}>
            <span className="mr-2 inline-block w-4 text-center">{state === "done" ? "✓" : state === "active" ? "…" : "·"}</span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
