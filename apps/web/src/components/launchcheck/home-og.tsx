import { ImageResponse } from "next/og";
import { copy } from "./copy";
import { experience as text } from "./experience-copy";

export function homeImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: "#f5f8ff", color: "#17243b", fontFamily: "sans-serif", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", width: 620, height: 620, borderRadius: 310, background: "#e1eaff", top: -20, right: -125, display: "flex" }}/>
    <div style={{ display: "flex", flexDirection: "column", padding: "54px 0 45px 60px", width: 650 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13, fontSize: 29, fontWeight: 700 }}><span style={{ display: "flex", background: "#3457cf", color: "white", width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 }}>↗</span>{copy.brand}</div>
      <h1 style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1.04, letterSpacing: -5, margin: "63px 0 24px", fontWeight: 700 }}><span>{text.heroFirst}</span><span>{text.heroSecond}</span></h1>
      <p style={{ fontSize: 23, lineHeight: 1.45, maxWidth: 510, color: "#405370", margin: 0 }}>{text.heroNote}</p>
      <div style={{ display: "flex", gap: 24, marginTop: "auto", alignItems: "center", fontSize: 19 }}><span style={{ background: "#3457cf", color: "white", padding: "14px 23px", borderRadius: 30 }}>{text.heroCta}</span><span style={{ color: "#536784" }}>launcheck.vercel.app</span></div>
    </div>
    <div style={{ position: "absolute", left: 715, top: 130, width: 400, height: 350, display: "flex", flexDirection: "column", border: "2px solid #becde5", borderRadius: 18, background: "white", transform: "rotate(-7deg)", boxShadow: "0 20px 30px #274a8f22" }}>
      <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 18px", gap: 7, borderBottom: "1px solid #d7e0ee" }}>{["#e89f8e", "#f0cf73", "#b6cdbd"].map(color => <span key={color} style={{ display: "flex", width: 8, height: 8, borderRadius: 5, background: color }}/ >)}<span style={{ fontSize: 11, marginLeft: 24, color: "#63748d" }}>{text.demoWebsite}</span></div>
      <div style={{ flex: 1, background: "#fff7e9", borderRadius: "0 0 16px 16px", padding: 25, display: "flex", flexDirection: "column" }}><span style={{ fontSize: 18, fontWeight: 700 }}>{text.demoName}</span><div style={{ display: "flex", alignItems: "center", marginTop: 20 }}><span style={{ fontSize: 39, fontWeight: 700, maxWidth: 210, lineHeight: 1.06 }}>{text.demoHeading}</span><span style={{ display: "flex", width: 100, height: 130, borderRadius: 60, background: "linear-gradient(90deg,#ffe4b5,#e58a54)", transform: "rotate(25deg)", marginLeft: 10 }}/></div><span style={{ marginTop: 22, fontSize: 12, padding: "10px 16px", background: "#263a36", color: "white", borderRadius: 6, alignSelf: "flex-start" }}>{text.demoButton}</span></div>
    </div>
    <div style={{ position: "absolute", left: 690, top: 435, width: 420, background: "white", border: "1px solid #d5deee", borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 17, transform: "rotate(3deg)", boxShadow: "0 10px 20px #274a8f15" }}><span style={{ color: "#963a22", background: "#ffede4", borderRadius: 10, fontSize: 26, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center" }}>!</span><div style={{ display: "flex", flexDirection: "column", gap: 5 }}><strong style={{ fontSize: 19 }}>{text.demoScenarios[0].problem}</strong><span style={{ fontSize: 12, color: "#596b84" }}>{copy.heroScope}</span></div></div>
    <div style={{ position: "absolute", right: 55, top: 68, width: 95, height: 95, borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, background: "#f3cf6d", transform: "rotate(12deg)" }}>↗</div>
  </div>, { width: 1200, height: 630 });
}
