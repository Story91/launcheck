// Build step: downloads the official Linux kpass CLI (Kite Passport) and verifies the pinned sha256 before bundling it
// into the LaunchCheck executor functions. Non-fatal: if it fails, the site still builds and the agent reports offline.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BUNDLE = 110;
const ARCHIVE = "cli/kpass_6.13.1_linux_amd64.tar.gz";
const SHA256 = "021c98c7e36b6882055e1c4825b441e24adfef15fa7d6ed273336f79db08124a";
const OUT = join(process.cwd(), ".kpass-bin");

async function main() {
  if (process.platform !== "linux" && process.env.KPASS_FETCH_FORCE !== "1") {
    console.log(`[fetch-kpass] skipped on ${process.platform} (set KPASS_FETCH_FORCE=1 to force)`);
    return;
  }
  if (existsSync(join(OUT, "kpass"))) {
    console.log("[fetch-kpass] already present");
    return;
  }
  const url = `https://cli.gokite.ai/bundle/${BUNDLE}/${ARCHIVE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== SHA256) throw new Error(`checksum mismatch: ${digest}`);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const archive = join(OUT, "kpass.tar.gz");
  writeFileSync(archive, bytes);
  execFileSync("tar", ["-xzf", "kpass.tar.gz"], { cwd: OUT, stdio: "inherit" });
  rmSync(archive);
  chmodSync(join(OUT, "kpass"), 0o755);
  console.log(`[fetch-kpass] kpass 6.13.1 (bundle ${BUNDLE}) verified and extracted`);
}

main().catch((e) => {
  console.warn(`[fetch-kpass] WARNING: ${e.message}. LaunchCheck executor will report offline.`);
});
