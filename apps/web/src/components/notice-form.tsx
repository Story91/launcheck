"use client";

import { isValidNoticeId } from "@tendr/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NoticeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = value.trim();
    if (!isValidNoticeId(id)) {
      setError("Enter a SAM.gov notice id (32 characters, from the sam.gov/opp/… link) or a TED publication number such as 722731-2026.");
      return;
    }
    router.push(`/report/${id}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm text-slate">
        SAM.gov notice id or TED number
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="e.g. the id in sam.gov/opp/<id>/view"
          className="border border-rule bg-white px-3 py-2 text-base text-ink placeholder:text-mist"
          aria-invalid={error ? true : undefined}
        />
      </label>
      <button type="submit" className="bg-ink px-4 py-2 text-base text-paper hover:bg-slate">
        Analyze notice
      </button>
      {error && <p className="text-sm text-seal sm:basis-full">{error}</p>}
    </form>
  );
}
