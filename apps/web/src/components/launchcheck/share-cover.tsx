"use client";
import { useEffect, useRef, useState } from "react";
import { experience } from "./experience-copy";
import { saveFile } from "./downloads";
import type { PreviewFields } from "./link-preview-code";
import { normalizeTarget } from "./format";
const text = experience.builder;
const palettes = { blue: ["#edf3ff", "#1d3155", "#3457cf", "#ccdaf9"], amber: ["#fff6e7", "#49311d", "#a95526", "#f2d293"], mint: ["#edf8f1", "#233d30", "#306d4c", "#bde1cb"] } as const;
type Theme = keyof typeof palettes;

// Measured wrapping also breaks long single words; user text is never interpreted as markup.
function lines(context: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number) {
  const rows: string[] = [];
  let line = "";
  for (let word of value.replace(/\s+/g, " ").trim().split(" ")) {
    if (line && context.measureText(line + " " + word).width <= maxWidth) { line += " " + word; continue; }
    if (line) { rows.push(line); line = ""; }
    while (context.measureText(word).width > maxWidth) {
      let chunk = "";
      for (const character of Array.from(word)) {
        if (chunk && context.measureText(chunk + character).width > maxWidth) break;
        chunk += character;
      }
      rows.push(chunk); word = word.slice(chunk.length);
    }
    line = word;
  }
  if (line) rows.push(line.trim());
  if (rows.length > maxLines) {
    rows.length = maxLines;
    let last = rows[maxLines - 1];
    while (last && context.measureText(last + "…").width > maxWidth) last = Array.from(last).slice(0, -1).join("");
    rows[maxLines - 1] = last.trimEnd() + "…";
  }
  return rows;
}
export function ShareCover({ fields }: { fields: PreviewFields }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [theme, setTheme] = useState<Theme>("blue");
  const [drawing, setDrawing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  let host = "";
  try { host = new URL(normalizeTarget(fields.url)).hostname; } catch { /* An unfinished address stays a placeholder. */ }
  const complete = !!(host && fields.title.trim() && fields.description.trim());
  useEffect(() => {
    let cancelled = false;
    setDrawing(true); setError(false); setMessage("");
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const c = canvas.current?.getContext("2d");
      if (!c) { setError(true); setDrawing(false); return; }
      const [paper, ink, accent, shape] = palettes[theme];
      const font = getComputedStyle(document.body).fontFamily;
      c.clearRect(0, 0, 1200, 630); c.fillStyle = paper; c.fillRect(0, 0, 1200, 630);
      c.fillStyle = shape; c.beginPath(); c.arc(1120, 270, 365, 0, 2 * Math.PI); c.fill();
      c.strokeStyle = accent; c.lineWidth = 18; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath(); c.moveTo(916, 350); c.lineTo(1054, 212); c.moveTo(950, 212); c.lineTo(1054, 212); c.lineTo(1054, 316); c.stroke();
      c.fillStyle = accent; c.font = `500 24px ${font}`;
      c.fillText(lines(c, host || text.hostPlaceholder, 740, 1)[0], 64, 83);
      c.fillStyle = ink; c.font = `700 72px ${font}`;
      const heading = lines(c, fields.title || text.titlePlaceholder, 720, 3);
      heading.forEach((row, i) => c.fillText(row, 60, 205 + i * 83));
      c.font = `400 27px ${font}`;
      lines(c, fields.description || text.descriptionPlaceholder, 700, 2).forEach((row, i) => c.fillText(row, 64, Math.max(390, 205 + heading.length * 83 + 30) + i * 38));
      c.fillStyle = accent; c.font = `500 18px ${font}`; c.fillText(text.coverCredit, 64, 588);
      setDrawing(false);
    }).catch(() => { if (!cancelled) { setError(true); setDrawing(false); } });
    return () => { cancelled = true; };
  }, [fields.title, fields.description, host, theme]);
  async function download() {
    if (!canvas.current || drawing || busy || !complete || error) return;
    setBusy(true); setMessage("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(value => value ? resolve(value) : reject(new Error("PNG")), "image/png"));
      saveFile(blob, "launcheck-cover.png"); setMessage(text.imageDone);
    } catch { setMessage(text.imageError); } finally { setBusy(false); }
  }
  return <section className="lc-cover-maker" aria-labelledby="cover-title"><h2 id="cover-title">{text.imageMaker}</h2><p>{text.imageMakerHint}</p><canvas ref={canvas} width={1200} height={630} role="img" aria-label={`${text.sampleCover}: ${fields.title || text.titlePlaceholder}`}/><div className="lc-cover-colors" role="group" aria-label={text.theme}>{(Object.keys(palettes) as Theme[]).map(value => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}><span style={{ background: palettes[value][2] }} aria-hidden="true"/>{text.themes[value]}</button>)}</div><button className="lc-button lc-button-quiet" type="button" disabled={!complete || drawing || busy || error} onClick={download}>{busy ? text.imageBusy : text.imageDownload}</button>{!complete && <p>{text.imageRequired}</p>}{(message || error) && <p role="status">{message || text.imageError}</p>}</section>;
}
