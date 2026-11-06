/** Bounded read-only navigation in a browser session purchased through Kite. No model-generated JS is executed. */
export interface NavigationStep { action: "open" | "click"; url: string; httpStatus: number | null }
export interface BrowserJourney { steps: NavigationStep[]; linkLabel: string | null; png: Buffer | null; error: string | null }

export function browserConnection(value: unknown, depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 5) return null;
  for (const [key, item] of Object.entries(value)) {
    if (["connectUrl", "connect_url", "browserWSEndpoint", "cdpUrl", "connectURL"].includes(key) && typeof item === "string") {
      try { const u = new URL(item); if (u.protocol === "wss:" && u.hostname.endsWith(".browserbase.com") && !u.username && !u.password) return u.href; } catch { /* not a connection */ }
    }
    const nested = browserConnection(item, depth + 1); if (nested) return nested;
  }
  return null;
}

export async function runBrowserJourney(endpoint: string, url: string): Promise<BrowserJourney> {
  const result: BrowserJourney = { steps: [], linkLabel: null, png: null, error: null };
  const target = new URL(url);
  if (!browserConnection({ connectUrl: endpoint }) || !["http:", "https:"].includes(target.protocol)) return { ...result, error: "Unsupported browser connection or target." };
  const socket = new WebSocket(endpoint); let nextId = 0; let sessionId: string | undefined;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const responses: { url: string; status: number }[] = [];
  const fail = () => { for (const call of pending.values()) { clearTimeout(call.timer); call.reject(new Error("Browser connection closed.")); } pending.clear(); };
  socket.addEventListener("message", event => {
    try {
      const message = JSON.parse(String(event.data));
      if (message.method === "Network.responseReceived" && message.sessionId === sessionId) { responses.push({ url: message.params.response.url, status: message.params.response.status }); if (responses.length > 500) responses.shift(); }
      const call = pending.get(message.id);
      if (call) { pending.delete(message.id); clearTimeout(call.timer); message.error ? call.reject(new Error("Browser command rejected.")) : call.resolve(message.result); }
    } catch { /* only structured CDP messages are consumed */ }
  });
  socket.addEventListener("close", fail); socket.addEventListener("error", fail);
  function send(method: string, params: Record<string, unknown> = {}, scoped = true): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); reject(new Error("Browser command timed out.")); }, 8000);
      pending.set(id, { resolve, reject, timer });
      try { socket.send(JSON.stringify({ id, method, params, ...(scoped && sessionId ? { sessionId } : {}) })); } catch { clearTimeout(timer); pending.delete(id); reject(new Error("Browser disconnected.")); }
    });
  }
  const evaluate = async (expression: string) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.value;
  const pause = () => new Promise(resolve => setTimeout(resolve, 200));
  async function waitForPage(previous?: string) {
    for (let i = 0; i < 75; i++) {
      const state = await evaluate("({url:location.href,ready:document.readyState})");
      if (state?.ready === "complete" && state.url !== "about:blank" && (!previous || state.url !== previous)) return String(state.url);
      await pause();
    }
    throw new Error("Navigation did not complete.");
  }
  function statusFor(href: string) {
    return responses.filter(r => { try { const a = new URL(r.url), b = new URL(href); return a.origin === b.origin && a.pathname === b.pathname; } catch { return false; } }).at(-1)?.status ?? null;
  }
  try {
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Browser connection timed out.")), 10000); socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true }); socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Browser connection failed.")); }, { once: true }); });
    const created = await send("Target.createTarget", { url: "about:blank" }, false);
    sessionId = (await send("Target.attachToTarget", { targetId: created.targetId, flatten: true }, false)).sessionId;
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: target.href });
    const opened = await waitForPage();
    if (new URL(opened).origin !== target.origin) throw new Error("Navigation left the requested origin.");
    result.steps.push({ action: "open", url: opened, httpStatus: statusFor(opened) });
    const links = await evaluate(`Array.from(document.querySelectorAll('nav a,header a,main a')).filter(a=>a.getClientRects().length).slice(0,30).map(a=>({href:a.href,label:(a.innerText||a.textContent||'').trim().slice(0,100)}))`);
    const candidates = (Array.isArray(links) ? links : []).filter(link => { try { const u = new URL(link.href); return ["http:", "https:"].includes(u.protocol) && u.origin === target.origin && !u.username && !u.password && u.href !== opened && !u.search && !/logout|signout|delete|remove|checkout|purchase|unsubscribe|download/i.test(u.pathname); } catch { return false; } });
    const link = candidates.find(l => /pricing/i.test(l.label)) ?? candidates[0];
    if (!link) { result.error = "No eligible public navigation link was found. Forms and account actions were not tested."; return result; }
    result.linkLabel = link.label;
    // The href is JSON-escaped data. Only an actual existing, visible anchor can be clicked.
    await evaluate(`(()=>{const a=Array.from(document.querySelectorAll('a')).find(a=>a.href===${JSON.stringify(link.href)}&&a.getClientRects().length);if(a){a.click();return true;}return false;})()`);
    const clicked = await waitForPage(opened);
    if (new URL(clicked).origin !== target.origin) throw new Error("Navigation left the requested origin.");
    await new Promise(resolve => setTimeout(resolve, 800));
    result.steps.push({ action: "click", url: clicked, httpStatus: statusFor(clicked) });
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    if (typeof shot.data === "string" && shot.data.length < 5_000_000) result.png = Buffer.from(shot.data, "base64");
  } catch { result.error = "The remote browser could not complete this navigation. No successful interaction is established."; }
  finally {
    if (socket.readyState === WebSocket.OPEN) await send("Browser.close", {}, false).catch(() => {});
    socket.close(); fail();
  }
  return result;
}
