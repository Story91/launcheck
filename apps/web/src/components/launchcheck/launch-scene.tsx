"use client";
import { useRef, useState, type PointerEvent } from "react";
import { experience as text } from "./experience-copy";

export function LaunchScene() {
  const [scenario, setScenario] = useState(0);
  const [fixed, setFixed] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const item = text.demoScenarios[scenario];
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (!scene.current || !matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - .5;
    const y = (event.clientY - box.top) / box.height - .5;
    scene.current.style.transform = `rotateX(${-y * 5}deg) rotateY(${x * 7}deg)`;
  }
  return <div className="lc-scene" onPointerMove={tilt} onPointerLeave={() => { if (scene.current) scene.current.style.transform = ""; }}>
    <div className="lc-scene-orbit" aria-hidden="true"/>
    <div className="lc-scene-stage" ref={scene}>
      <div className="lc-scene-sheet lc-scene-sheet-back" aria-hidden="true"/>
      <div className={`lc-scene-browser ${fixed ? "is-fixed" : ""}`} data-scenario={item.id}>
        <div className="lc-scene-chrome"><span className="lc-window-dots" aria-hidden="true"><i/><i/><i/></span><span>{text.demoWebsite}</span><span aria-hidden="true">↗</span></div>
        <div className="lc-scene-site">
          <div className="lc-orbit-wordmark"><span aria-hidden="true">✳</span>{text.demoName}<span className="lc-orbit-menu" aria-hidden="true">☰</span></div>
          {item.id === "preview" ? <div className="lc-scene-social"><div className="lc-scene-social-art"><span aria-hidden="true">✳</span><strong>{fixed ? text.demoHeading : item.issue}</strong></div><div><span>{text.demoWebsite}</span><h3>{fixed ? text.demoSub : text.demoWebsite}</h3></div></div> : <><div className="lc-orbit-art" aria-hidden="true"><span/><span/><span/><span/></div><div className="lc-orbit-content"><h3>{fixed && item.id === "link" ? text.demoPricing : text.demoHeading}</h3><p>{fixed && item.id === "link" ? text.demoPriceText : text.demoSub}</p><span className="lc-orbit-cta">{text.demoButton}<span aria-hidden="true">↗</span></span></div></>}
          <div className="lc-scan-line" aria-hidden="true"/>
        </div>
      </div>
      <div className={`lc-scene-callout ${fixed ? "is-fixed" : ""}`} aria-live="polite"><span className="lc-scene-symbol" aria-hidden="true">{fixed ? "✓" : "!"}</span><div><strong>{fixed ? item.solution : item.issue}</strong><span>{fixed ? item.fixed : item.problem}</span></div></div>
      <div className="lc-scene-sticker" aria-hidden="true"><span>↗</span><span>↗</span></div>
    </div>
    <div className="lc-scene-controls"><div className="lc-scene-tabs" role="group" aria-label={text.demoSelect}>{text.demoScenarios.map((tab, i) => <button key={tab.id} type="button" aria-pressed={i === scenario} onClick={() => { setScenario(i); setFixed(false); }}>{tab.label}</button>)}</div><button type="button" className="lc-scene-fix" onClick={() => setFixed(value => !value)}>{fixed ? text.demoReset : text.demoFix}<span aria-hidden="true">{fixed ? "↶" : "✳"}</span></button><p>{text.demoLabel} · {text.demoCount}</p></div>
  </div>;
}
