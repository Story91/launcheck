# LaunCheck brand guide

Date: 6 November 2026. Updated for the owner’s publication brief: a friendly launch-day workbench, an interactive illustrative browser, and compact evidence reports.

## Identity

Name: LaunCheck. Headline: **Catch the oops. Before the launch.** The memorable artifact connects an observation to its evidence, provider and payment. Actual captures are more useful here than generated background photos.

## Visual language

Paper `#fafbfd`, secondary paper `#eef3fb`, ink `#17243b`, secondary ink `#354661`, accent `#3457cf`, rule `#dce3ee`. The interactive illustration uses warm orange and yellow, separate from outcome colors. Manrope headings and DM Sans prose/controls. Monospace is reserved for identifiers and hashes. Use the existing component tokens.

Left-align report content. Compact rows progressively disclose evidence. Unknown is neutral gray; observed problems use restrained red; observed clear checks use green. Green must not imply an unperformed check succeeded. Preserve visible keyboard focus, 48px primary controls, wrapping IDs, reduced-motion support and 390px layouts.

## Voice and claims

Sentence case, concrete verbs: “Check again after fixing”, “Copy fix brief”, “Open full-size evidence”. State what was observed and when. Distinguish proposed fixes from completed repairs, catalogue quotes from settled payments, token estimates from full inference bills.

No overall scores, probabilities, risk grades, rankings or certification. The executable banned-word list and tests govern quality claims. Label illustrative examples. A screenshot establishes appearance; one navigation is one interaction, not whole-app coverage.

## Sharing

Use actual counts and settled payments. “Fixed X of Y” requires comparable evidence; unknown remains unresolved. “Paid for by an AI agent” describes real paid runs only. Badges link to the receipt and age visibly after 30 days. Never put third-party reports into a gallery without owner consent.

## Publication experience

Lead with the user’s task: paste a page, see what needs attention, prepare fixes, run another check. Wallet identifiers and spending mechanics stay available through disclosure. The homepage browser is explicitly an interactive illustration, never live evidence. A one-time scan explains the checking idea; pointer tilt only runs for fine pointers with motion enabled. Reduced-motion users get the same controls with no moving scan.

The fix workspace exports selected findings and their evidence to the user’s coding agent; it does not modify a repository or mark a finding fixed. Example packs carry `illustrative: true`. The link-preview builder runs locally in the tab, validates public addresses, escapes output, and exports HTML or Next.js metadata. It does not load user-provided images or promise that a platform has refreshed a preview.

## Animation research

Reviewed [Motion](https://github.com/motiondivision/motion), [Three.js](https://github.com/mrdoob/three.js), and [React Bits](https://github.com/DavidHDev/react-bits). The selected browser interaction uses original CSS transforms and React state; no third-party component source was copied and no animation dependency was installed. This keeps the entry page light while retaining keyboard controls, a static fallback and reduced-motion support.

## Second layout review

The launch desk now follows the hero directly. A compact numbered process sits inside the same container as the form, a historical first-party report and the provider explanation. Separate logo/process bands, a second proof banner and the duplicate gallery were removed from the homepage. The gallery remains reachable from navigation and the desk. Below the desk are two compact action cards and FAQ.

The link-preview builder can render and download a local 1200×630 PNG in blue, amber or mint. The entered title, description and public hostname form the actual asset, with measured line wrapping. It sends no image request and does not upload the result; instructions explicitly require hosting the file and adding its address to the generated metadata.
