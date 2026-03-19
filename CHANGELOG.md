# Changelog

All notable changes to figlets are documented here.

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
