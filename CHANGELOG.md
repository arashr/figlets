# Changelog

All notable changes to figlets are documented here.

---

## v1.4.0 — 2026-04-09

### fig-document 1.1.0

#### New: `doc-runner.js` — single-file spec sheet pipeline

Replaces the multi-script step approach with one concatenated script (`detect-ds-context.js` + `doc-runner.js`). All sections — bounds, bindings, fonts, palette, frame construction — run in a single `use_figma` call. Three substitution points at the top of the file:

1. `compName` — component name string
2. `_usageDo` / `_usageDont` — usage guideline arrays
3. `_variantDesc` — map of exact variant name → ≤10-word purpose string (new)

#### New: variant showcase redesigned for designers and PMs

- **All variants shown** — removed the 6-variant cap; every variant in the COMPONENT_SET is included
- **Wrapping layout** — showcase uses `layoutWrap = 'WRAP'` and fills the full doc width so variants flow into rows rather than extending off-canvas
- **Per-variant descriptions** — each card shows a purpose line below the variant name when `_variantDesc[v.name]` is populated; Claude generates these at skill run time from the variant names obtained in the pre-step
- **Legibility** — variant name changed from 10px regular/subtle to 11px semibold/ink for easier scanning

#### Removed: Token Bindings table from Figma spec sheet

The token bindings table (Section E) has been removed from the visual spec sheet — it has no value for designers and PMs. Token binding data is still collected and written to `component-specs/[Name].md` for LLM and developer handover, and the Sizing section still shows padding/spacing token references.

#### Bug fixes

- **`resize()` resets sizing modes (critical)** — `primaryAxisSizingMode`/`counterAxisSizingMode` are now set *after* `resize()` in all five locations (`doc` frame, `_mkTable`, `_mkRow`, `_mkCell`, `_secF`). Previously, `resize()` silently overwrote these to `'FIXED'`, causing every auto-sized container to render at 1px height.
- **Property name regex strips Figma node-ID suffixes (moderate)** — changed `/#\d+$/` to `/#[^#]+$/` in both the Properties table and the `[SPEC]` description block. Figma uses `name#<number>:<number>` format (e.g. `label#31:0`); the old regex never matched because `:0` is not pure digits.
- **Anatomy badges cluster and overflow (minor)** — `_collectEl` now skips depth 0 (the root component frame, which placed a badge at negative coordinates) and skips `INSTANCE`-type nodes (which share their parent `FRAME`'s bounding box, causing duplicate overlapping badges).
- **`_dsCol` follows VARIABLE_ALIAS chains** — semantic color tokens are stored as aliases to primitives; the previous `raw?.r !== undefined` gate always failed on aliases, so every palette color fell back to the hardcoded warm-cream defaults. `_dsCol` now recursively resolves alias chains (up to depth 4), matching the same logic used in `_resolveVar`.

#### Workflow update (`SKILL.md`)

- Step 1 now runs `find-component.js` to obtain exact variant name strings before generating `_variantDesc`
- Step 2 documents all three substitutions with a worked example
- Step 4 output updated to reflect removed Token Bindings section

---

### fig-document (prior changes in this cycle)

#### `build-doc-frame.js`

- **`_dsColor()` palette helper added** — resolves spec sheet colors from DS variable names before falling back to hardcoded neutral values; wired to all color references in preview frame, showcase, anatomy badges, table rows, and label fills
- **`makeCell()` helper added** — creates a fixed-width cell frame containing a correctly-sized text node (`textAutoResize = 'HEIGHT'`); documents the rule that bare text nodes must never be appended directly to table rows
- **`makeTableRow()` updated** — `counterAxisAlignItems` changed from `'CENTER'` to `'MIN'` (top-align for multi-line cells); padding increased from 10px to 12px
- **`textAutoResize = 'WIDTH_AND_HEIGHT'`** set after `appendChild` on section labels and variant labels (previously missing, which caused 0-height text on free-standing nodes)

#### `read-bindings.js`

- **`resolveVarValue` converted from async to sync** — now uses `_allVars.find()` from the `detect-ds-context.js` snapshot instead of `figma.variables.getVariableByIdAsync()`; removes all `await` calls in the resolution loop, making the script fully synchronous

---

### fig-create

#### `SKILL.md` + `node-patterns.js` — container fill and clip rules clarified

- **Containers must never have a background fill** — `fills = []` is now explicit and mandatory on both `COMPONENT` and `COMPONENT_SET` nodes; `bindFill` on the container is no longer listed as a binding step; any fill on a container is a `/fig-qa` violation
- **`clipsContent = false` added to pattern** — must be set immediately after creating `COMPONENT` and `COMPONENT_SET` nodes, before appending children; added to `node-patterns.js` for both single-component and variant-set patterns
- **Container layout rule** — `layoutMode` must always be `'HORIZONTAL'` or `'VERTICAL'`, never `'NONE'`

---

## v1.3.0 — 2026-04-08

### Bug fixes

#### `skills/shared/detect-ds-context.js` + `skills/shared/parse-variables.js`

- **`_resolveFloat` now follows multi-level alias chains** — previously stopped after one hop, so component-scoped tokens that alias semantic tokens that alias primitives (e.g. `Tag·Size → spacing/sm → spacing/base/4`) returned `null` instead of the resolved pixel value. Now follows up to 5 levels. Fixes `—` showing up in the Resolved Value column of the token bindings table for variables in newly-created collections.

#### `skills/fig-document/scripts/read-bindings.js`

- **`resolvedVal` field added to output** — script now returns `[{ node, property, token, resolvedVal }]` instead of `[{ node, property, token }]`. Resolved value is `#rrggbb` for colors, `Npx` for floats, `fontSize/lineHeight` for text styles, `—` on failure. Resolution uses `getVariableByIdAsync` in a loop (not the pre-fetched `_allVars` snapshot) so variables in collections created in the same session are found reliably.

#### `skills/fig-create/scripts/type-collection.js`

- **Async lint guard added** — prominent `⚠️ ASYNC RULE` comment block at the top of the file lists `getLocalVariables()` and `getLocalVariableCollections()` as `✗ NEVER use`, and their async equivalents as `✓`. Any size-collection or `getOrCreateVar` helper derived from this template will carry the rule forward.

#### `skills/fig-document/scripts/build-doc-frame.js`

- **Font family and style detected from DS text styles** — replaced hardcoded `{ family: 'Inter', style: 'Semi Bold' }` / `'Bold'` / `'Regular'` throughout the script with `_docFamily`, `_docSemibold`, `_docBold`, `_docRegular` variables populated from `_allTextStyles` (provided by `detect-ds-context.js`). Regex `/semi.?bold/i` matches both `'Semi Bold'` (Inter) and `'SemiBold'` (Sora, Nunito, etc.). Fixes silent font-load fallback to Regular for spec sheet labels in non-Inter design systems.
- **`makeTableRow` helper added** — creates full-width rows whose height hugs content. Sets `counterAxisSizingMode = 'AUTO'` before calling `resize(totalW, 1)` so the height is never locked by the resize call. Prevents compressed rows in the spec sheet tables. Comments document the required ordering rule.

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
