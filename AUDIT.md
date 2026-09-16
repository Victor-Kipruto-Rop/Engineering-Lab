# Engineering Lab — Phase 0 Audit

Repo: `Victor-Kipruto-Rop/Engineering-Lab` · Audited: 2026-09-16
Stack confirmed: HTML5 + vanilla ES modules + JSON, no frameworks. Deploys via GitHub Actions to GitHub Pages with custom domain `lab.victorkipruto.com`.

## What's already working well (preserve this)

- Honest labeling exists in real places already: telemetry is marked `DEMO` / "Synthetic telemetry generator", the data explorer has a visible "SANITIZED DEMO DATA" banner, the API playground marks every response "simulated, local." This is the right instinct and matches the spirit of the brief — it should be extended, not replaced.
- `js/app.js` gives a clean shared shell: nav injection, mobile drawer, a consistent `loadJSON()` fetch contract with `{ok, data, error}`, an `escapeHTML()` used consistently (no raw interpolation → no obvious XSS surface from JSON data).
- Architecture viewer (`architecture.js`) already has pan, zoom, click-to-inspect, keyboard activation (Enter/Space), and a legend — this is a genuinely solid foundation for the "signature feature" the brief asks for.
- Systems registry has working search/filter/sort with URL param deep-linking (`?system=`).
- Data explorer has working sort/filter/paginate/expand-row.
- Accessibility basics exist: `:focus-visible` styles, `prefers-reduced-motion` handled in two stylesheets, `aria-live` regions on dynamic content, semantic `<dialog>` for the architecture inspector, keyboard support on custom controls.
- Responsive: two real breakpoints (880px → drawer nav, 600px → table-to-card transform), not just font shrinking.
- CI already does something real: validates every JSON file parses, checks for `<!DOCTYPE html>`, greps for obvious secret patterns, then deploys — this is a legitimate start on Phase 20/27, not just a placeholder workflow.
- No secrets, credentials, or private hostnames found anywhere in the repo.

## Broken / silently misleading (fix first — these violate the "no fabricated evidence" rule as-is)

1. **Architecture data only covers 1 of 4 systems that claim to have it.** `data/architecture.json` has exactly one system (`pesaguard`). But `systems.json` marks `features.architecture: true` for `pesaguard`, `streaming-fraud`, `lakehouse`, and `cloud-etl`. Clicking "Inspect system" for the other three sends you to `architecture.html?system=streaming-fraud`, which silently falls back to rendering PesaGuard's diagram with no notice. That's not a crash — it's worse: it shows the wrong system's architecture as if it were correct. This needs either real diagrams for those systems or the feature flags corrected to `false` with a per-system "architecture not yet documented" message.
2. **Every "GitHub" / "View source" link goes to the profile page, not a repo or file.** 14 occurrences across `data/systems.json` (6) and `js/code.js` (8) all point to `https://github.com/Victor-Kipruto-Rop` instead of the actual repository. This directly undercuts "keep source links accurate" — a reviewer clicking "View source on GitHub" from the idempotency snippet lands on your profile, not the code.
3. **Experiments are all wins.** All 4 entries in `js/experiments.js` conclude `PASS`. The brief specifically asks for at least one failed experiment (expected/actual/root cause/fix/retest) to show iteration, not a highlight reel.
4. **Experiments have no ID, date, or version.** The brief's format is `EXP-001`, with a date and reproducibility block (dataset/command/environment/version). Current entries have hypothesis→conclusion but no identifier or date, so nothing is technically "reproducible" as specified.

## Missing relative to the brief (real gaps, not nitpicks)

- **Monitor page**: no time-range selector (5m/15m/1h/6h/24h — spec asks for this), no incident-simulation controls (Kafka down, DB latency, consumer crash, etc.) at all.
- **Data explorer**: no schema viewer (column/type/nullable/description/constraints), no data-quality metrics (null rate, duplicate rate, freshness, completeness), no lineage visualization. Current page is filter/sort/paginate only.
- **API playground**: no "Copy curl" / "Copy Python" (only "Copy" for the response body).
- **System detail pages**: there's no per-system deep page with the 12-section layout (data model, components, security, observability, performance, failure handling, etc.) — right now a "system" is a card + an architecture diagram (for 1 of 6) +, for PesaGuard only, a case study.
- **Engineering decision records**: PesaGuard's case study has a "decisions" section in prose, but not the structured Context/Options/Chosen/Trade-off format the brief defines as its own artifact type.
- No `assets/` directory exists yet — fine today since nothing references missing images, but the structure in the brief expects one.

## Data model / vocabulary mismatch

`systems.json` uses status values `ACTIVE / DEMO / EXPERIMENTAL / ARCHIVED`, and there's no `evidence` array or `deployment` field. The brief's vocabulary is `LIVE / DEPLOYED / BENCHMARKED / EXPERIMENTAL / DEMO / ARCHIVED` for status plus a separate `evidence: [CONCEPT|PROTOTYPE|IMPLEMENTED|TESTED|BENCHMARKED|DEPLOYED]` array. Worth deciding once and migrating all systems together rather than mixing vocabularies.

Also worth a note: PesaGuard's description says "Running with one pilot customer" and the metrics block calls the environment "Pilot production" — if that's current and accurate, it's fine and should stay; if it's no longer accurate it should be corrected, since this is exactly the kind of claim the brief says must be backed by real evidence.

## Performance

- Google Fonts loaded via `@import` inside `main.css` (`fonts.googleapis.com`) — this blocks CSS parsing and delays font discovery. A `<link rel="preconnect">` + `<link rel="stylesheet">` pair in `<head>` (or self-hosting the two IBM Plex weights actually used) is a quick win.
- No JS is currently loaded that isn't needed per-page — each page only pulls `app.js` + its own module, so Phase 19's "don't load every page's JS everywhere" is already satisfied.

## SEO

- Titles, meta descriptions, canonical URLs, and basic OG tags exist on every page. `sitemap.xml` and `robots.txt` both exist and point at the custom domain correctly.
- Missing: Twitter/X card meta, and no structured data (JSON-LD) anywhere.

## Security

- No secrets found. GitHub Actions already greps for common secret patterns pre-deploy.
- No Content-Security-Policy meta tag on any page yet (Phase 20 asks for one where compatible with GitHub Pages).

## Accessibility

- Solid foundation (see above). Not checked without a real browser: color contrast ratios for `--text-2` (#91A69E) on `--surface`, and whether the architecture SVG remains usable via keyboard beyond node selection (no keyboard pan/zoom, only pointer-based).

## Duplicated code

- The rail/sidebar/toggle markup is copy-pasted at the top of every page (9 files) instead of being injected by `app.js` the way the nav links already are. Low risk, but it's the reason nav *items* are DRY while the *shell chrome* around them isn't.
- `systemCard()` in `index.html`'s inline script and `pages/systems.html`'s inline script are near-identical — worth extracting into a shared component module (this is exactly what Phase 24's `SystemCard` component is for).

## Not yet checked (needs a browser, not static reading)

Actual console errors, real contrast ratios, and on-device layout at 320–430px are things I can't fully verify by reading source — flagging rather than claiming they're clean.

---

## Recommended order (given everything above)

1. Fix the two misleading items (architecture fallback, GitHub links) — these are "evidence integrity" bugs, not features.
2. Add 1–2 failed experiments + IDs/dates to the existing 4.
3. Decide the status/evidence vocabulary once, migrate `systems.json`.
4. Extract shell chrome + `SystemCard` into shared modules (removes duplication before more pages get added).
5. Then move into the bigger net-new work: system detail pages, data explorer schema/lineage/quality, monitor time-range + incident simulation, API playground copy-curl/python.
