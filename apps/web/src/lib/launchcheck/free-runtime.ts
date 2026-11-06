import { assertPublicUrl, runFreeChecks, type FreeCheckDeps } from "@tendr/core/server";
import { lookup, resolveTxt } from "node:dns/promises";
import { connect } from "node:tls";

// Real I/O for the free checks: DNS, TXT records and the TLS peer certificate, all with short timeouts.

async function lookupAll(host: string): Promise<string[]> {
  const rows = await lookup(host, { all: true, verbatim: true });
  return rows.map((r) => r.address);
}

async function txt(name: string): Promise<string[][]> {
  try {
    return await resolveTxt(name);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENODATA" || code === "ENOTFOUND") return [];
    throw e;
  }
}

function peerCertificate(host: string): Promise<{ issuer: string; validFrom: string; validTo: string; subjectAltNames: string[] }> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert || !cert.valid_to) return reject(Object.assign(new Error("no certificate"), { code: "NO_CERT" }));
      const issuer = [cert.issuer?.O, cert.issuer?.CN].filter(Boolean).join(" / ");
      const sans = (cert.subjectaltname ?? "").split(",").map((s) => s.trim().replace(/^DNS:/, "")).filter(Boolean);
      resolve({ issuer, validFrom: new Date(cert.valid_from).toISOString(), validTo: new Date(cert.valid_to).toISOString(), subjectAltNames: sans });
    });
    socket.on("timeout", () => socket.destroy(Object.assign(new Error("tls timeout"), { code: "ETIMEDOUT" })));
    socket.on("error", reject);
  });
}

export function freeDeps(): FreeCheckDeps {
  return { fetchImpl: fetch, lookup: lookupAll, resolveTxt: txt, peerCertificate, now: () => new Date(), region: process.env.VERCEL_REGION ?? "local" };
}

export const runFreeChecksLive = (url: string) => runFreeChecks(url, freeDeps());
export const assertPublicUrlLive = (url: string) => assertPublicUrl(url, lookupAll);
