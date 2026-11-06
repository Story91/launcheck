"use client";

import { isValidNoticeId } from "@tendr/core/ted/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Accepts a bare id or anything pasted from SAM.gov (sam.gov/opp/<id>/view) or TED (URL, "Notice 722731-2026", …). */
export function extractNoticeId(raw: string): string {
  const sam = raw.match(/\b([0-9a-f]{32})\b/i);
  if (sam) return sam[1];
  const ted = raw.match(/\b(\d{1,6}-\d{4})\b/);
  return ted ? ted[1] : raw.trim();
}

export function NoticeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = extractNoticeId(value);
    if (!isValidNoticeId(id)) {
      setError("Paste a SAM.gov or TED link, a SAM.gov notice id or a TED number such as 722731-2026.");
      return;
    }
    router.push(`/report/${id}`);
  }

  return (
    <form onSubmit={submit} className="notice-form">
      <label htmlFor="ted-link">
        SAM.gov or TED notice
      </label>
      <div className="notice-input-group">
        <input
          id="ted-link"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Paste a SAM.gov or TED link"
          className="notice-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "notice-error" : undefined}
        />
        <button type="submit" className="notice-submit">
          Analyze tender
        </button>
      </div>
      {error && <p id="notice-error" role="alert" className="notice-error">{error}</p>}
    </form>
  );
}
