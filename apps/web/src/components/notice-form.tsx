"use client";

import { isValidNoticeId } from "@tendr/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Accepts a bare id or anything pasted from TED (URL, "Notice 722731-2026", …). */
export function extractNoticeId(raw: string): string {
  const m = raw.match(/\b(\d{1,8}-\d{4})\b/);
  return m ? m[1] : raw.trim();
}

export function NoticeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = extractNoticeId(value);
    if (!isValidNoticeId(id)) {
      setError("Paste a TED link or a publication number such as 722731-2026.");
      return;
    }
    router.push(`/report/${id}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="sr-only" htmlFor="ted-link">
        TED link or publication number
      </label>
      <div className="flex rounded-2xl border-2 border-ink bg-white focus-within:ring-2 focus-within:ring-tide">
        <input
          id="ted-link"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Paste a TED link"
          className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3.5 text-lg text-ink outline-none placeholder:text-mist"
          aria-invalid={error ? true : undefined}
        />
        <button type="submit" className="m-1.5 rounded-xl bg-ink px-4 text-paper hover:bg-slate">
          Analyze
        </button>
      </div>
      {error && <p className="text-sm text-seal">{error}</p>}
    </form>
  );
}
