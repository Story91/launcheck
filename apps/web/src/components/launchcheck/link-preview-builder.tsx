"use client";
import Link from "next/link";
import { ShareCover } from "./share-cover";
import { useState } from "react";
import { experience } from "./experience-copy";
import { previewCode, type PreviewFields } from "./link-preview-code";
import { saveFile } from "./downloads";
import { normalizeTarget } from "./format";
const text = experience.builder;
export function LinkPreviewBuilder() {
  const [fields, setFields] = useState<PreviewFields>({ title: "", description: "", url: "", image: "" });
  const [kind, setKind] = useState<"html" | "next">("html");
  const [message, setMessage] = useState("");
  const code = previewCode(fields, kind);
  let target = "", host = text.hostPlaceholder as string;
  try { target = normalizeTarget(fields.url); host = new URL(target).hostname; } catch { /* Incomplete edits are not links. */ }
  function update(field: keyof PreviewFields, value: string) { setFields(previous => ({ ...previous, [field]: value })); setMessage(""); }
  async function copyCode() { if (!code) return; try { await navigator.clipboard.writeText(code); setMessage(text.copied); } catch { setMessage(text.manual); } }
  return <div className="lc-preview-builder"><div className="lc-builder-grid"><form className="lc-builder-fields" onSubmit={event => event.preventDefault()}>
    <label htmlFor="preview-title">{text.titleLabel}</label><input id="preview-title" value={fields.title} onChange={e => update("title", e.target.value)} maxLength={200} placeholder={text.titlePlaceholder}/>
    <label htmlFor="preview-description">{text.descriptionLabel}</label><textarea id="preview-description" value={fields.description} onChange={e => update("description", e.target.value)} maxLength={500} rows={3} placeholder={text.descriptionPlaceholder}/>
    <label htmlFor="preview-url">{text.urlLabel}</label><input id="preview-url" inputMode="url" autoComplete="url" value={fields.url} onChange={e => update("url", e.target.value)} placeholder={text.urlPlaceholder}/>
    <label htmlFor="preview-image">{text.imageLabel}</label><input id="preview-image" inputMode="url" value={fields.image} onChange={e => update("image", e.target.value)} placeholder={text.imagePlaceholder} aria-describedby="preview-image-hint"/><p id="preview-image-hint">{text.imageHint}</p>
  </form><aside className="lc-builder-preview"><h2>{text.preview}</h2><div className="lc-built-card"><div className="lc-built-art"><span aria-hidden="true">↗</span><span>{text.imagePlaceholderLabel}</span></div><div><span>{host}</span><h3>{fields.title || text.titlePlaceholder}</h3><p>{fields.description || text.descriptionPlaceholder}</p></div></div><p>{text.previewNote}</p><p>{text.privacy}</p><ShareCover fields={fields}/></aside></div>
    <section className="lc-builder-output"><div className="lc-section-heading"><h2>{text.output}</h2><div className="lc-check-filters" role="group" aria-label={text.output}>{(["html", "next"] as const).map(value => <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setMessage(""); }}>{text[value]}</button>)}</div></div><p>{kind === "html" ? text.htmlHelp : text.nextHelp}</p><textarea aria-label={text.output} readOnly value={code ?? text.invalid} rows={12} onFocus={event => { if (code) event.currentTarget.select(); }}/><div className="lc-builder-actions"><button type="button" disabled={!code} className="lc-button" onClick={copyCode}>{text.copy}</button><button type="button" disabled={!code} className="lc-button lc-button-quiet" onClick={() => { if (!code) return; saveFile(new Blob([code], { type: "text/plain;charset=utf-8" }), kind === "html" ? "launcheck-link-preview.html" : "launcheck-metadata.ts"); setMessage(text.downloaded); }}>{text.download}</button><Link className="lc-text-link" href={target ? `/check?${new URLSearchParams({ url: target })}` : "/check"}>{text.check}</Link></div>{message && <p role="status">{message}</p>}</section>
  </div>;
}
