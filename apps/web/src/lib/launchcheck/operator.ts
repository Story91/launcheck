import { timingSafeEqual } from "node:crypto";
function equal(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x,y); }
/** Existing owner key, or a short-lived acceptance-test key. Neither key is exposed through the app. */
export function isLaunchcheckOperator(req: Request) {
  const supplied = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!supplied) return false;
  if (process.env.CRON_SECRET && equal(supplied,process.env.CRON_SECRET)) return true;
  const temporary = process.env.LAUNCHCHECK_OPERATOR_TOKEN;
  const expires = temporary && /^(\d{10})\.[a-f0-9]{64}$/.exec(temporary)?.[1];
  return !!temporary && !!expires && Number(expires)*1000 > Date.now() && equal(supplied,temporary);
}
