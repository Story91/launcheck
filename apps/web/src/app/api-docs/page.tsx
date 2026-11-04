export default function ApiDocsPage() {
  // The x402 service shares this deployment's domain (see vercel.json rewrites for /v1 and /healthz).
  const host = process.env.NEXT_PUBLIC_SITE_URL ?? "https://<your-deployment>";
  return (
    <div className="max-w-[72ch] space-y-8">
      <section>
        <h1 className="text-3xl">Buy a report from your agent</h1>
        <p className="mt-3 text-slate leading-relaxed">
          Verified reports are sold per call over x402 (HTTP 402 payments). Your agent requests the report, receives a 402 with payment terms, pays in USDC and gets the JSON in the same round trip. Reports that are not yet verified return 409 and are never charged.
        </p>
      </section>
      <section>
        <h2 className="text-xl">Endpoint</h2>
        <pre className="mt-2 overflow-x-auto bg-paper-deep p-4 text-sm"><code>{`GET ${host}/v1/report/{noticeId}\n\n402 → pay → 200 application/json (the report)\n409 → { "status": "pending_verification", "retryAfterSeconds": 60 }\n404 → unknown notice\n\nGET ${host}/healthz   (free)`}</code></pre>
      </section>
      <section>
        <h2 className="text-xl">With Kite Agent Passport</h2>
        <pre className="mt-2 overflow-x-auto bg-paper-deep p-4 text-sm"><code>{`kpass session create --task-summary "buy tender report" \\\n  --max-amount-per-tx 1 --max-total-amount 5 --ttl 24h --assets USDC --output json\n# approve with your passkey, then:\nkpass session execute --url ${host}/v1/report/722731-2026 --method GET --output json`}</code></pre>
        <p className="mt-3 text-sm text-slate">The session caps what the agent can spend; every purchase shows up in <code>kpass activity</code>.</p>
      </section>
      <section>
        <h2 className="text-xl">Price</h2>
        <p className="mt-2 text-slate">One report, one price, shown in the 402 response. No account needed.</p>
      </section>
    </div>
  );
}
