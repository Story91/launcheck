import { PAID_CHECKS, type Catalog } from "@tendr/core";
import { TIER_BUDGET_USD } from "@/lib/launchcheck/executor";
import { json } from "@/lib/launchcheck/fixture-mode";

export const dynamic = "force-dynamic";

const FREE_CHECKS: { checkId: string; label: string }[] = [
  { checkId: "page_fetch", label: "Page response" },
  { checkId: "security_headers", label: "Security headers" },
  { checkId: "tls_cert", label: "TLS certificate" },
  { checkId: "share_tags", label: "Link preview tags" },
  { checkId: "og_image_fetch", label: "Link preview image" },
  { checkId: "email_dns", label: "Email DNS (SPF, DMARC)" },
  { checkId: "link_status", label: "Links on the page" },
];

/** Tiers and the check menu. Paid entries come from the registry of purchase-confirmed prices only. */
export async function GET() {
  const catalog: Catalog = {
    tiers: [
      { id: "quick", label: "Quick", budgetUsd: TIER_BUDGET_USD.quick },
      { id: "standard", label: "Standard", budgetUsd: TIER_BUDGET_USD.standard, default: true },
      { id: "full", label: "Full", budgetUsd: TIER_BUDGET_USD.full },
    ],
    checks: [
      ...FREE_CHECKS.map((c) => ({ ...c, kind: "free" as const, priceUsd: 0 })),
      ...PAID_CHECKS.map((c) => ({ checkId: c.checkId, label: c.label, kind: "paid" as const, priceUsd: c.priceUsd, vendorHost: c.vendorHost, tiers: c.tiers })),
    ],
  };
  return json(catalog);
}
