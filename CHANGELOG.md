# Changelog

All notable changes to figlets are documented here.

---

## v1.2.0 — 2026-04-07

### fig-setup 1.4.0

#### Architecture

- **Primitives-first enforcement** — semantic and responsive collections (Collections 2–5) are now aliases only; no raw values permitted. `create-typography-vars.js` uses `requireAlias()` which throws if a primitive is missing rather than silently setting a raw value
- **Pre-validation pass** — `create-typography-vars.js` checks every required primitive exists in Collection 1 before creating any variables; throws with the full list of missing names so a misconfigured scale is caught before any variables are created
- **Semantic color pairs** — the Collection 2 mapping preview is now pair-first (bg + text + inline WCAG ratio). bg and text tokens are no longer shown as separate flat lists. No pair may be built with a ratio below 4.5:1 without explicit user approval
- **Config generated from scratch** — removed stale instruction to read a template file; config is always generated from intake answers using the full schema

#### New scripts

- **`create-primitives.js`** — builds Collection 1 from `DS.color.ramps`, type scale, and spacing; derives extra size/tracking primitives from `DS.typography.scale` so semantic aliases are always satisfiable
- **`create-typography-vars.js`** — builds Collection 3 with responsive modes; all size/weight/tracking/family variables are `VARIABLE_ALIAS` to Collection 1; line-height is intentionally raw px (ratio × size computation)
- **`detect-design-system.js`** — detects existing variable collections and infers config values; populates `_meta.needsInput` for fields that require intake
- **`shared/parse-variables.js`** — shared utility providing `varByName`, `colorVarByHex`, `spacingVarByValue`, `typographyVarByValue`, and `rgbDist`

#### Bug fixes

- **`naming.textStyle` prefix validation** — startup throws with a clear message if `DS.naming.textStyle` starts with a placeholder (`{role}/{size}` → `{role}` is invalid in Figma variable names); default is `type/{role}/{size}`
- **Decimal spacing names** — `space/0.5` is an invalid Figma variable path; fractional steps are now sanitized to `space/0-5`. `SPACING_8` also gains `[11, 44]` — the 44px WCAG 2.5.5 minimum touch target was missing from the 8px scale
- **`create-text-styles.js`** — `setBoundVariable('fontStyle', weightVar)` threw because `fontStyle` requires a STRING variable; fixed to use `'fontWeight'` (FLOAT) matching what Figma's UI exposes. `figma.loadFontAsync` now called via `Promise.all` before the loop — loading fonts inside the loop caused failures on the first `fontName` assignment
- **Font availability fallback** — `listAvailableFontsAsync()` is used to verify each weight's style name exists in the font before setting `fontName`; fallback chain: desired → Semi Bold → Bold → Regular
- **Showcase accessibility** — Section A (primitive ramps) no longer shows WCAG contrast badges; a single color has no accessibility value without context. Section B (semantic pairs) now computes contrast between the actual bg and text variable pair, not against a fixed white/black reference
- **Hook input format** — all four guardrail hooks (`auto-install`, `lazy-load-check`, `pre-commit`, `shared-library-check`) were reading `CLAUDE_TOOL_INPUT` env var which is always empty; Claude Code passes tool data via stdin as JSON with shape `{ tool_input: { file_path, ... } }`

#### PRE-FLIGHT rules added (9–11)

- Rule 9: Accessibility badges belong on pairs, never on isolated colors
- Rule 10: Pre-validate all alias targets before creating any variables
- Rule 11: Semantic pairing is structural — define bg+text pairs with inline contrast ratios; no flat separate lists

---

## v1.1.0 — 2026-03-19

### fig-setup 1.3.2 (new skill)

New skill bootstrapping a complete Figma variable architecture from scratch.

- **Collection 1 — Primitives**: color ramps (WCAG/APCA contrast tables), scrim primitives (black/white with alpha), shadow numeric primitives (FLOAT), type scale, spacing scale
- **Collection 2 — Color Semantics**: Light/Dark aliases — role-based and surface-based naming (Material 3 style), scrim semantic tokens (`color/scrim/*`, `color/state/*`), shadow color aliases (`color/shadow/key`, `color/shadow/ambient`) using white scrims in dark mode for visible depth
- **Collection 3 — Typography**: M3-style naming (`type/display/lg|md|sm` through `type/label/lg|md|sm`) — 15 roles; Figma Text Styles created and each property bound to Collection 3 variables; Mobile/Desktop responsive modes
- **Collection 4 — Spacing**: Mobile/Desktop responsive — component, layout, inset, stack, touch target, radius, and border tokens
- **Collection 5 — Elevation**: 6 Effect Styles (`elevation/0` through `elevation/5`) with `offsetY`, `radius`, and `color` bound to variables; shadow color shifts in dark mode via semantic variable (`scrim/white/20` in dark, `scrim/black/20` in light)
- **Token Showcase**: all values bound to variables — color ramps with WCAG contrast badges, semantic pairs (bg/fg), scrim overlay demos (stacked fills), typography scale, spacing bars, border radius, border width, and elevation cards

### fig-create 1.1.0

- **Effect preservation**: when building from a selected Figma frame, reads and carries over its effects to the built component; matches against existing Effect Styles by shadow radius/offsetY before falling back to raw effect copy
- **Elevation Effect Style detection**: if the file has Effect Styles (e.g. `elevation/1`–`elevation/5`), automatically applies the matching style instead of creating a new raw effect
- **`clipsContent = true` rule**: PRE-FLIGHT rule #14 — any `DROP_SHADOW` with `spread > 0` requires `clipsContent = true` on the frame or Figma hides the shadow entirely; applied automatically to focus ring variants
- **`bindEffect` helper**: null-safe `setBoundVariableForEffect` wrapper added to the variable binding helpers block

### Fixes

- `marketplace.json`: added required `owner` field; fixed `source` path format (`./` prefix)
- fig-setup Effect Styles: replaced raw `setBoundVariableForEffect` calls with null-safe `bindEffectField` helper to prevent silent variable unbinding when a primitive variable is missing

---

## v1.0.0 — 2026-03-10

Initial release.

### Skills
- **fig-create 1.0.0** — Build a production-quality Figma component with full token binding, state variants, prototype wiring, and accessibility checks.
- **fig-qa 1.0.0** — Audit a component or page for token/variable compliance; auto-fix or review one-by-one.
- **fig-document 1.0.0** — Generate a visual spec sheet in Figma and a `component-specs/[Name].md` LLM handover file.

---

## [2026-03-11 12:02] fig-qa — Portfolio · Components · Button / Glass 1.0.0

**Scope:** Selection (COMPONENT_SET node `1420:5761`)
**Fixed:** 1 violation
**Skipped:** 0
**Cleaned up:** 1 duplicate leftover node from failed build (`1420:4975`) removed

| Node | Property | Raw Value | Bound To |
|---|---|---|---|
| Button / Glass 1.0.0 | Fill color | `rgb(229,224,250)` | `Purple 97` |
