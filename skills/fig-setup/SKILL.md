---
name: fig-setup
version: 1.4.0
description: Bootstrap a complete Figma variable architecture for a new design system — color primitives, semantic light/dark tokens, responsive typography, and spacing. Standalone skill. Use when setting up Figma variables, creating design tokens, or starting a new design system from scratch.
---

# fig-setup

You are a senior design systems engineer. Bootstrap a complete, production-grade Figma variable architecture — one collection at a time, step by step. Mobile-first, accessible (WCAG 2.2 AA minimum, APCA-annotated), scalable.

**CRITICAL**: Never output the full system in one shot. Show a preview table for each collection, wait for confirmation, then build in Figma. The user controls the pace.

---

## PRE-FLIGHT: Variable API rules

1. **Batch in one `use_figma` call** — create a collection, all modes, and all variables in a single Plugin API script. Never split variable creation across multiple tool calls.
2. **Alias format** — when aliasing a variable to a primitive, use `{ type: "VARIABLE_ALIAS", id: "<primitiveVariableId>" }` as the value, not a raw hex or number.
3. **Mode IDs** — `collection.addMode()` returns a `modeId`. Store all mode IDs immediately after creation — they're required for every value assignment.
4. **Folder grouping** — use `/` separators in variable names (e.g., `color/brand/500`). Figma renders these as nested folders.
5. **Primitives: hide from publishing** — set `collection.hiddenFromPublishing = true` AFTER creating at least the first variable in the collection (not immediately after `createVariableCollection()`). Wrap in try/catch — the setter throws on empty collections and on some Figma plan tiers.
6. **Primitives first, always** — before building any semantic or responsive collection (Color Semantics, Typography, Spacing), every value that collection needs must already exist as a primitive in Collection 1. Never set a raw number or hex in Collections 2–5. If a needed primitive is missing, stop and add it to Collection 1 first.
7. **Semantic collections are aliases only** — every variable in Collections 2–5 must be a `VARIABLE_ALIAS` pointing to a Collection 1 primitive. The only legitimate raw values are computed properties that primitives cannot express (e.g. typography line-height in px, which is size × ratio and cannot be stored as a direct alias). All sizes, weights, tracking values, colors, and spacing values must be aliases.
8. **Conflict check first** — at the start of each collection, call `mcp__Figma__get_variable_defs` to check if a collection with that name already exists. Ask the user before overwriting.
9. **Accessibility belongs on pairs, never on isolated colors** — a single color has no accessibility value in isolation. WCAG contrast only has meaning between a foreground and a background. Consequences: (a) In the token showcase, Section A (primitive ramps) shows swatches with step name and hex only — no contrast badges. Section B (semantic pairs) shows contrast computed from the actual bg+text variable pair — never vs a fixed reference color. (b) In the semantic mapping preview, every bg token must be shown paired with its text counterpart and a computed WCAG ratio before building. Never present bg tokens and text tokens as separate flat lists.
10. **Pre-validate all alias targets before creating any variables** — at the start of any script that builds a semantic or responsive collection, load all existing Collection 1 variable names into a Set and check every intended alias target against it. Collect all missing names and throw with the full list before creating a single variable. A missing primitive caught upfront is a config fix; a missing primitive caught mid-build is a half-built collection that must be manually deleted.
11. **Semantic pairing is structural, not a post-check** — define bg+text pairs together in the mapping preview. The contrast ratio is shown inline for every pair. No pair may be built with a ratio below 4.5:1 without explicit user approval and a documented reason. Tokens that have no text counterpart (borders, icons, scrims, shadows) are listed separately and labeled with their relevant standard (3:1 for icons/borders, composite for scrims). Disabled text tokens are explicitly exempt from contrast requirements (WCAG 1.4.3).

For `use_figma` calls (showcase phase), component API rules also apply: fill colors use `{r,g,b}` only, `FILL` sizing set after appendChild, async collection calls only.

---

## Shared design system contract

- **Single source of truth:** The variable collections you create here are the authoritative library for `/fig-create`, `/fig-qa`, and `/fig-document`. All three skills load variables from this file and reference collection names via `DS.collections.*`.
- **Naming stability matters:** Renaming or restructuring a collection after components have been built will cause fig-qa violations and broken token references in fig-document. Treat collection names as a public API — communicate changes before restructuring.
- **Config = contract:** `design-system.config.js` is the machine-readable version of the decisions made here. Every collection name, mode name, and token naming pattern written to config must match what is built in Figma.
- **No hardcoded user decisions in scripts:** Any value that varies between projects must come from `DS.*` read from `design-system.config.js` — never written as a literal in a script. This includes font families (`DS.typography.families.sans`), scale sizes (`DS.typography.scale`), collection names (`DS.collections.*`), breakpoint modes (`DS.breakpoints.modes`), brand colors (`DS.color.brand.*`), and spacing base (`DS.grid.base`). Fixed structural names (weight labels, t-shirt sizes, shadow property names) are fine as literals.

---

## Phase 0 — Config Check

Before asking any questions, check for an existing config file:

**If `design-system.config.js` exists in the working directory:**
- Read it and present a summary: project name, platform, grid base, typeface, collections.
- Ask: "Found an existing config. Use it, update it, or start fresh?"
  - **Use it** → skip intake, proceed directly to Architecture Overview using config values.
  - **Update it** → run intake for only the fields the user wants to change, then rewrite the file.
  - **Start fresh** → delete the config, run full intake below.

**If no config exists:**
- Run detect: Read `~/.claude/skills/fig-setup/scripts/detect-design-system.js` then run via `use_figma`.
- Parse the returned JSON. For each field in `_meta.detectedFields`, present the detected value and confirm: "Detected [field]: [value] — correct?"
- Ask only the questions in `_meta.needsInput` (skip already-detected fields).
- After all answers collected, write `design-system.config.js` in the working directory using the confirmed values.

**If updating an existing DS** (user chose "Update it" or is adding collections to an existing system): also read `~/.claude/skills/shared/detect-ds-context.js` and run via `use_figma`. This gives the runtime view of what already exists (variable collections, text styles, effect styles) so the update can build on top of it rather than overwriting. Use `DS_CONTEXT.collectionByName` to check what collections already exist before creating new ones.

**After intake or config load:** proceed to Architecture Overview.

---

## Phase 0 — Project Intake

Ask only the questions not already answered by detection or the existing config. One at a time. Wait for each answer before continuing.

**Q1 — Project name**
> What should this design system be called?

**Q2 — Platform / dev stack**
> What will this system feed into?
> - Web (CSS custom properties / design tokens JSON)
> - React Native
> - Multi-platform (web + native)
> - Other (describe)

**Q3 — Spacing base unit**
> Which spacing base unit?
> - **4px** — tight, dense UIs (good for data-heavy products)
> - **8px** — most common, recommended for most products

**Q4 — Breakpoints**
> Which breakpoint tier?
> - **3-tier**: Mobile <768px / Tablet 768–1199px / Desktop ≥1200px
> - **4-tier**: Mobile <640px / Tablet 640–1023px / Desktop 1024–1439px / Wide ≥1440px

**Q5 — Semantic color naming**
> How should semantic color tokens read?
> - **Role-based**: `color/bg/brand`, `color/text/danger`, `color/border/subtle` — reads naturally, close to CSS
> - **Surface-based**: `color/surface/brand`, `color/on-surface/brand`, `color/outline/default` — Material 3 style, great for multi-platform
>
> Reply "explain" if you want a side-by-side comparison before deciding.

**Q6 — Color scale**
> How many steps per color ramp?
> - **50–950, 10 steps** (Tailwind-style — widely understood, good tooling support)
> - **100–900, 9 steps** (Material-style — simpler, coarser)
> - **0–1000, 11 steps** (fine granularity — for complex multi-brand systems)
>
> Reply "explain" if you want the tradeoffs.

**Q7 — Brand colors**
> Provide 1–3 hex values: primary, and optionally secondary + accent.
> Reply "TBD" if undecided — I'll use placeholders and flag them clearly.

**Q8 — Typeface(s)**
> What font family or families are you using?
> Reply "suggest" if undecided — I'll recommend a pairing.

**Q9 — Typography scale**
> Which type scale style?
> - **Material 3** (default) — balanced, suitable for most products
> - **Fluid** — larger display text (48–80px), ideal for marketing and expressive UIs
> - **Compact** — tighter overall scale, good for dense data-heavy products
> - **Custom** — I'll show you the full table to adjust values
>
> Reply "show" to preview the full table before deciding.

After Q9, confirm the full scale as a table before writing to config. For **Fluid**, use: display/lg desktop 72px, display/md 60px, display/sm 48px; scale headline/title/body/label the same as Material 3. For **Compact**, use: display/lg desktop 45px, display/md 36px, display/sm 30px; headline/lg 24px, headline/md 20px, headline/sm 18px; title/body/label same as Material 3. For **Custom**, show the Material 3 defaults and let the user edit specific rows.

The confirmed scale — including any per-role customizations — must be written to `DS.typography.scale` in the config. `DS.breakpoints.modes` must also be written with the confirmed mode names (default: `['Mobile', 'Tablet', 'Desktop']`, add `'Wide'` for 4-tier).

**After all answers collected — write config:**

Generate `design-system.config.js` from scratch using the intake answers and detection results. Do not look for or read a template file — the config is always generated, never copied. Include every field the scripts depend on: `DS.collections.*`, `DS.naming.*`, `DS.grid.*`, `DS.breakpoints.modes`, `DS.breakpoints.tier`, `DS.color.*`, `DS.typography.families`, `DS.typography.scale` (all 15 roles with sizes, lineHeights, weight, tracking per breakpoint mode). This file is the single source of truth for all fig-setup scripts in this project.

---

## Architecture Overview

Once intake is complete, explain this before any build work:

> We'll build 4 variable collections in order:
>
> | # | Collection | Modes | Purpose |
> |---|---|---|---|
> | 1 | **Primitives** | 1 mode | Raw values — color ramps, type scale, spacing scale. Hidden from publishing. Never applied to components directly. |
> | 2 | **Color / Semantics** | Light, Dark | Semantic color roles aliased to primitives. What components actually use. |
> | 3 | **Typography** | Mobile, Tablet, Desktop [+ Wide] | Responsive type scale — font size, line height, letter spacing per breakpoint. |
> | 4 | **Spacing** | Mobile, Tablet, Desktop [+ Wide] | Responsive spacing — component padding, layout gaps, section spacing. |
> | 5 | **Elevation** | 1 mode | Shadow scale — numeric properties as variables + Figma Effect Styles per level, all bound to variables. |
>
> Each collection is independent — frames can be in Dark mode AND Mobile typography simultaneously, no combinatorial explosion.
>
> I'll show you a preview table for each collection, wait for your confirmation, then build it in Figma.

---

## Collection 1 — Primitives

### Conflict check

Call `mcp__Figma__get_variable_defs`. Use `DS.collections.primitives` from config as the collection name. If a collection with that name already exists, ask:
> "A '[DS.collections.primitives]' collection already exists. Overwrite it, append new variables, or skip to Collection 2?"

### 1A. Color Primitives

Generate a full ramp for every brand color + neutral + utility ramps (danger/success/warning/info).

**Scale** per user's choice. Name format: `color/[hue]/[step]`

- **50–950, 10 steps**: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
- **100–900, 9 steps**: 100, 200, 300, 400, 500, 600, 700, 800, 900
- **0–1000, 11 steps**: 0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000

**Ramps to generate (always):** `color/[primary-name]`, `color/[secondary-name]` (derive complementary if not provided), `color/neutral`, `color/red` (danger/error), `color/green` (success/positive), `color/yellow` (warning/caution), `color/blue` (info).

**Ramp rules:**
- Mid step (500 or equivalent) = closest match to the provided brand hex
- Lighten toward minimum step (mix with white, reduce saturation slightly)
- Darken toward maximum step (mix with black, preserve hue)
- Each adjacent step must maintain ≥3:1 contrast ratio for palette legibility
- Flag any step that won't achieve 4.5:1 against white OR black — these cannot be used for body text without pairing constraints

**Show a preview table before building.** Example format:

```
color/[hue]/[step]   #XXXXXX   vs white: X.X:1   vs black: X.X:1   [usable for: ...]
```

After the ramp table, output a contrast annotation:

```
color/[hue] on white (#FFFFFF):
  /[step] → WCAG: X.X:1 | decorative bg only
  /[step] → WCAG: X.X:1 | APCA: ~Lc XX | large text (AA), icons
  /[step] → WCAG: X.X:1 | APCA: ~Lc XX | body text (AA) ✓
  /[step] → WCAG: X.X:1 | APCA: ~Lc XX | body text (AAA) ✓

color/[hue] on black (#000000):
  /[step] → WCAG: X.X:1 | body text on dark bg ✓
  ...
```

Note: WCAG 2.2 AA = 4.5:1 body, 3:1 large text (≥24px or ≥18.67px bold). AAA = 7:1 / 4.5:1. APCA Lc 60+ for body; Lc 45+ for large text.

### 1A-ii. Scrim Primitives

Semi-transparent overlay colors for hover, pressed, modal backdrops, and disabled washes. Store as COLOR variables with alpha baked in — Figma COLOR variables support `{r,g,b,a}`.

**Show as preview table, then confirm before building:**

```
color/scrim/black/4    rgba(0,0,0, 0.04)   ← hairline tint
color/scrim/black/8    rgba(0,0,0, 0.08)   ← hover overlay
color/scrim/black/12   rgba(0,0,0, 0.12)   ← pressed overlay
color/scrim/black/20   rgba(0,0,0, 0.20)   ← disabled wash
color/scrim/black/40   rgba(0,0,0, 0.40)   ← modal backdrop (light mode)
color/scrim/black/60   rgba(0,0,0, 0.60)   ← modal backdrop (dark content)

color/scrim/white/8    rgba(255,255,255, 0.08)   ← dark-mode hover
color/scrim/white/12   rgba(255,255,255, 0.12)   ← dark-mode pressed
color/scrim/white/16   rgba(255,255,255, 0.16)   ← dark-mode selected
color/scrim/white/20   rgba(255,255,255, 0.20)   ← dark-mode key shadow (elevation lift)
```

> ⚠️ Never collapse alpha out of scrim variables. The transparency IS the token value — scrims are applied as fill layers on top of content.

### 1A-iii. Shadow Primitives

Numeric values for the elevation shadow system. FLOAT variables for offsetY/radius per level.

```
— Shadow key (main directional shadow) —
shadow/1/offset-y    1     shadow/4/offset-y   12
shadow/1/radius      2     shadow/4/radius     24
shadow/2/offset-y    4     shadow/5/offset-y   16
shadow/2/radius      8     shadow/5/radius     32
shadow/3/offset-y    8
shadow/3/radius     16

(spread = 0 for all levels — no clipsContent requirement)
(offsetX = 0 for all levels)

— Shadow ambient (secondary fill light shadow, levels 2–5) —
shadow/ambient/2/radius    8
shadow/ambient/3/radius   12
shadow/ambient/4/radius   16
shadow/ambient/5/radius   20
```

### 1B. Type Primitives

Raw type values — never applied directly to components. Name format: `type/[property]/[step]`

**Show as a preview table, then confirm before building:**

```
— Families (String variables) —
type/family/sans     "[user's font or recommended]"
type/family/mono     "[mono font — always include for code/data]"

— Weights (Number variables) —
type/weight/regular  400
type/weight/medium   500
type/weight/semibold 600
type/weight/bold     700

— Font sizes (Number, px) — mobile-first base —
type/size/2xs  10    type/size/3xl  30
type/size/xs   12    type/size/4xl  36
type/size/sm   14    type/size/5xl  48
type/size/md   16    type/size/6xl  60
type/size/lg   18    type/size/7xl  72
type/size/xl   20
type/size/2xl  24

— Line heights (Number, multipliers — not px) —
type/line-height/tight    1.2    ← headings
type/line-height/snug     1.35
type/line-height/normal   1.5    ← body text
type/line-height/relaxed  1.65
type/line-height/loose    1.8

— Letter spacing (Number, %) —
type/tracking/tight   -0.02
type/tracking/normal   0
type/tracking/wide     0.02
type/tracking/wider    0.05
type/tracking/widest   0.1
```

> ⚠️ **Figma note**: Figma line height variables must be px values (not multipliers). When these are applied in Collection 3, calculate actual px values — e.g., 16px × 1.5 = 24px. Store the multipliers here as a readable reference only.

### 1C. Spacing Primitives

Name format: `space/[step]`

**For 8px base:**
```
space/0   0     space/8   32    space/24   96
space/1   4     space/10  40    space/32  128
space/2   8     space/12  48    space/40  160
space/3   12    space/16  64    space/48  192
space/4   16    space/20  80    space/64  256
space/5   20
space/6   24
```

**For 4px base** — halve values, add fine steps:
```
space/0    0     space/5   20    space/16   64
space/0.5  2     space/6   24    space/20   80
space/1    4     space/8   32    space/24   96
space/2    8     space/10  40    space/32  128
space/3    12    space/12  48
space/4    16
```

### Build Collection 1

After previewing all three sections and the user confirms:

1. Before building: write `DS.color.ramps` to `design-system.config.js` with the ramp data calculated during the 1A preview — each entry `{ folder: 'color/[hue]', steps: [[step, r, g, b], ...] }`, r/g/b as 0–1 floats. Then call `run_skill_script("fig-setup/scripts/create-primitives.js")` and run result via `use_figma`. The script reads ramps from `DS.color.ramps` and creates the collection, all variable groups, and sets `hiddenFromPublishing` safely after the first variable.
2. Call `mcp__Figma__get_screenshot` — verify the variable panel shows the expected variable count and grouping. Confirm that `color/scrim/*` and `shadow/*/offset-y` appear in the list.

Ask: "Collection 1 — Primitives is built. Does the color ramp look right? Any hues to adjust before we wire up semantics in Collection 2?"

---

## Collection 2 — Color Semantics

### Conflict check

Call `mcp__Figma__get_variable_defs`. If "Color / Semantics" collection already exists, ask to overwrite / append / skip.

### Semantic mapping — pair-first

**Every background token is defined together with its text token(s) and their contrast ratio. You cannot define a bg without its text pair. You cannot build until every pair meets ≥4.5:1 (AA). No exceptions.**

Use the naming convention chosen in intake. Substitute actual WCAG ratios calculated from the primitives chosen in Phase 1A. Flag any pair that fails — suggest the nearest primitive step that achieves 4.5:1, then confirm the adjustment with the user before proceeding.

```
💡 APCA note: dark mode body text should aim for Lc 75+, not just WCAG 4.5:1.
   Flag any dark text token below Lc 60.
ℹ️  Scrims, borders, icons, shadows are not bg/text pairs — listed separately below.
   Do not include them in ratio checks. Composite contrast (bg + scrim + text)
   is verified separately for hover/overlay states.
```

**Role-based naming — paired surfaces:**

```
Collection: Color / Semantics
Modes: Light | Dark

— Role: default (page + neutral surface) ——————————————————————————————————————
  bg:   color/bg/default      Light: neutral/50    Dark: neutral/950
  ├─ text: color/text/default  Light: neutral/950   Dark: neutral/50
  │        → Light: [X.X:1 ✓AA ✓AAA]   Dark: [X.X:1 ✓AA ✓AAA]
  ├─ text: color/text/subtle   Light: neutral/700   Dark: neutral/300
  │        → Light: [X.X:1 ✓AA]         Dark: [X.X:1 ✓AA]
  └─ text: color/text/muted    Light: neutral/500   Dark: neutral/500
           → Light: [X.X:1 ⚠ borderline] Dark: [X.X:1 ⚠]  ← decorative only if <4.5

  bg:   color/bg/subtle        Light: neutral/100   Dark: neutral/900
  └─ text: color/text/default  (same token as above — verify ratio on this bg)
           → Light: [X.X:1 ✓AA]          Dark: [X.X:1 ✓AA]

  bg:   color/bg/muted         Light: neutral/200   Dark: neutral/800
  └─ text: color/text/default  (same token — verify ratio on this bg)
           → Light: [X.X:1 ✓AA]          Dark: [X.X:1 ✓AA]

— Role: inverse ————————————————————————————————————————————————————————————————
  bg:   color/bg/default       Light: neutral/50    Dark: neutral/950
  └─ text: color/text/inverse  Light: neutral/50    Dark: neutral/950
           → [used for inverse chips / reversed banners — verify at use site]

— Role: brand ——————————————————————————————————————————————————————————————————
  bg:   color/bg/brand         Light: [primary]/600  Dark: [primary]/500
  └─ text: color/text/on-brand Light: neutral/50     Dark: neutral/950
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

  bg:   color/bg/brand-subtle  Light: [primary]/50   Dark: [primary]/950
  └─ text: color/text/brand    Light: [primary]/700  Dark: [primary]/300
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

— Role: danger —————————————————————————————————————————————————————————————————
  bg:   color/bg/danger        Light: red/600        Dark: red/500
  └─ text: color/text/on-danger  Light: neutral/50   Dark: neutral/950
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

  bg:   color/bg/danger-subtle Light: red/50         Dark: red/950
  └─ text: color/text/danger   Light: red/700        Dark: red/300
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

— Role: success ————————————————————————————————————————————————————————————————
  bg:   color/bg/success       Light: green/600      Dark: green/500
  └─ text: color/text/on-success Light: neutral/50   Dark: neutral/950
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

  bg:   color/bg/success-subtle Light: green/50      Dark: green/950
  └─ text: color/text/success  Light: green/700      Dark: green/300
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

— Role: warning ⚠ yellow almost always fails with light text ————————————————
  bg:   color/bg/warning       Light: yellow/500     Dark: yellow/400
  └─ text: color/text/on-warning Light: neutral/950  Dark: neutral/950  ← MUST be dark text
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

  bg:   color/bg/warning-subtle Light: yellow/50     Dark: yellow/950
  └─ text: color/text/warning  Light: yellow/800     Dark: yellow/300
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

— Role: info ———————————————————————————————————————————————————————————————————
  bg:   color/bg/info          Light: blue/600       Dark: blue/500
  └─ text: color/text/on-info  Light: neutral/50     Dark: neutral/950
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

  bg:   color/bg/info-subtle   Light: blue/50        Dark: blue/950
  └─ text: color/text/info     Light: blue/700       Dark: blue/300
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]
```

**Role-based — unpaired tokens (no text counterpart — contrast enforced at component level):**

```
— Disabled text (intentionally sub-AA — decorative signal of unavailability) —
color/text/disabled       Light: neutral/400   Dark: neutral/600
  ← WCAG 1.4.3 exception: disabled controls are exempt from contrast requirements

— Borders (decorative / structural — not text) —
color/border/default      Light: neutral/200   Dark: neutral/800
color/border/subtle       Light: neutral/100   Dark: neutral/900
color/border/strong       Light: neutral/400   Dark: neutral/600
color/border/brand        Light: [primary]/500 Dark: [primary]/500
color/border/danger       Light: red/500       Dark: red/500
color/border/focus        Light: [primary]/500 Dark: [primary]/400   ← focus ring: 3:1 vs adjacent bg required

— Icons (3:1 required for graphical objects per WCAG 1.4.11, not 4.5:1) —
color/icon/default        Light: neutral/700   Dark: neutral/300
color/icon/subtle         Light: neutral/500   Dark: neutral/500
color/icon/brand          Light: [primary]/600 Dark: [primary]/400
color/icon/danger         Light: red/600       Dark: red/400
color/icon/success        Light: green/600     Dark: green/400
color/icon/warning        Light: yellow/700    Dark: yellow/400
color/icon/info           Light: blue/600      Dark: blue/400
color/icon/inverse        Light: neutral/50    Dark: neutral/950

— Elevation surfaces (text color from role:default pair above) —
color/surface/default     Light: neutral/50    Dark: neutral/950   ← page bg
color/surface/raised      Light: neutral/100   Dark: neutral/900   ← cards
color/surface/overlay     Light: neutral/200   Dark: neutral/800   ← modals
color/surface/sunken      Light: neutral/200   Dark: neutral/800   ← inputs, wells

— Scrims / state layers (layered on content — composite contrast only) —
color/scrim/overlay       Light: scrim/black/40    Dark: scrim/black/60
color/scrim/hover         Light: scrim/black/8     Dark: scrim/white/8
color/scrim/pressed       Light: scrim/black/12    Dark: scrim/white/12
color/scrim/disabled      Light: scrim/black/20    Dark: scrim/black/20
color/scrim/selected      Light: scrim/black/12    Dark: scrim/white/16

— Shadow colors —
color/shadow/key          Light: scrim/black/20    Dark: scrim/white/20
color/shadow/ambient      Light: scrim/black/8     Dark: scrim/white/8
```

**Surface-based naming — paired surfaces:**

```
Collection: Color / Semantics
Modes: Light | Dark

— Role: default ————————————————————————————————————————————————————————————————
  bg:   color/surface/default      Light: neutral/50    Dark: neutral/950
  ├─ text: color/on-surface/default Light: neutral/950  Dark: neutral/50
  │        → Light: [X.X:1 ✓AA ✓AAA]   Dark: [X.X:1 ✓AA ✓AAA]
  └─ text: color/on-surface/variant Light: neutral/700  Dark: neutral/300
           → Light: [X.X:1 ✓AA]         Dark: [X.X:1 ✓AA]

  bg:   color/surface/variant      Light: neutral/100   Dark: neutral/900
  └─ text: color/on-surface/default (verify ratio on this bg)
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

— Role: brand ——————————————————————————————————————————————————————————————————
  bg:   color/surface/brand        Light: [primary]/600  Dark: [primary]/500
  └─ text: color/on-surface/brand  Light: neutral/50     Dark: neutral/950
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

  bg:   color/surface/brand-variant Light: [primary]/50  Dark: [primary]/950
  └─ text: color/on-surface/default (verify ratio on this bg)
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

— Role: danger —————————————————————————————————————————————————————————————————
  bg:   color/surface/danger       Light: red/600        Dark: red/500
  └─ text: color/on-surface/danger Light: neutral/50     Dark: neutral/950
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

  bg:   color/surface/danger-variant Light: red/50       Dark: red/950
  └─ text: color/on-surface/default  (verify ratio on this bg)
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

— Role: success ————————————————————————————————————————————————————————————————
  bg:   color/surface/success      Light: green/600      Dark: green/500
  └─ text: color/on-surface/success Light: neutral/50    Dark: neutral/950
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

— Role: warning ⚠ ——————————————————————————————————————————————————————————————
  bg:   color/surface/warning      Light: yellow/500     Dark: yellow/400
  └─ text: color/on-surface/warning Light: neutral/950   Dark: neutral/950  ← MUST be dark
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]

— Role: info ———————————————————————————————————————————————————————————————————
  bg:   color/surface/info         Light: blue/600       Dark: blue/500
  └─ text: color/on-surface/info   Light: neutral/50     Dark: neutral/950
           → Light: [X.X:1 ✓AA]   Dark: [X.X:1 ✓AA]
```

**Surface-based — unpaired tokens:**

```
— Disabled text —
color/on-surface/disabled   Light: neutral/400   Dark: neutral/600  ← exempt per WCAG 1.4.3

— Outline —
color/outline/default       Light: neutral/300   Dark: neutral/700
color/outline/subtle        Light: neutral/200   Dark: neutral/800
color/outline/strong        Light: neutral/500   Dark: neutral/500
color/outline/brand         Light: [primary]/500 Dark: [primary]/500
color/outline/focus         Light: [primary]/500 Dark: [primary]/400  ← 3:1 vs adjacent bg
color/outline/danger        Light: red/500       Dark: red/500

— State / overlay / shadow —
color/overlay/scrim    Light: scrim/black/40    Dark: scrim/black/60
color/state/hover      Light: scrim/black/8     Dark: scrim/white/8
color/state/pressed    Light: scrim/black/12    Dark: scrim/white/12
color/state/disabled   Light: scrim/black/20    Dark: scrim/black/20
color/state/selected   Light: scrim/black/12    Dark: scrim/white/16
color/shadow/key       Light: scrim/black/20    Dark: scrim/white/20
color/shadow/ambient   Light: scrim/black/8     Dark: scrim/white/8
```

🔴 **Any pair with ratio below 4.5:1 = STOP.** Suggest the nearest primitive step that achieves 4.5:1 minimum and confirm the adjustment with the user. Do not build until every paired surface passes.

Confirm the complete pair table with the user before building.

### Build Collection 2

1. Call `use_figma` to create the Color Semantics collection with Light + Dark modes and all alias variables in a single script. All values must be variable aliases referencing Collection 1 variable IDs — never raw hex.
2. Call `mcp__Figma__get_screenshot` to verify.

Ask: "Collection 2 — Color Semantics is built. Do the dark mode mappings feel right? Any semantic roles missing for your product? When confirmed, we'll move to responsive typography."

---

## Collection 3 — Typography

### Conflict check

Call `mcp__Figma__get_variable_defs`. If "Typography" collection already exists, ask to overwrite / append / skip.

### Type scale preview

Generate the preview table from `DS.typography.scale` and `DS.breakpoints.modes`. Do not use hardcoded values — every row comes from the config. Format:

```
Collection: [DS.collections.typography]
Modes: [DS.breakpoints.modes.join(' | ')]

— [category] —
[tokenName(role, size)]/size          [modes: sizes from DS.typography.scale[role/size].sizes]
[tokenName(role, size)]/line-height   [modes: lineHeights]
[tokenName(role, size)]/weight        [weight] (all modes)
[tokenName(role, size)]/tracking      [tracking] (all modes)
```

Show all 15 roles grouped by category (Display / Headline / Title / Body / Label). After the table, add accessibility notes for any role where the smallest size is below 14px — flag it as decorative-only.

Ask: "Does this scale look right? Any roles to adjust before I build?"  Apply any changes to `DS.typography.scale` in the config before proceeding.

### Build Collection 3

1. Call `run_skill_script("fig-setup/scripts/create-typography-vars.js")` then run result via `use_figma`. The script creates the collection with Mobile/Tablet/Desktop modes (+ Wide if `DS.breakpoints.tier >= 4`) and applies the following alias strategy:
   - **weight** → always aliased to `type/weight/*` primitive (400/500/600/700 all have matches)
   - **tracking** → aliased to `type/tracking/*` where exact match exists; raw value otherwise
   - **family** → aliased to `type/family/sans` primitive
   - **size** → aliased to `type/size/*` where the px value exists in the primitive scale; raw otherwise
   - **line-height** → raw computed px per mode (primitives store ratio multipliers, not px)

### Create Figma Text Styles (required — do not skip)

After variables are built, create one Figma Text Style per role and bind every property to the corresponding Typography variable. Call `run_skill_script("fig-setup/scripts/create-text-styles.js")` then run result via `use_figma`. The script prefers variables from the Typography collection so styles bind to Collection 3 (which then aliases into Collection 1) — not directly to primitives.

> **Note on fontFamily binding**: `setBoundVariable('fontFamily', var)` binds a String variable to the style's font family. If it throws on the user's Figma version, fall back to `style.fontName = { family: resolvedFamilyValue, style: 'Regular' }` and log a warning.

4. `mcp__Figma__get_screenshot` — verify the Styles panel shows 15 text styles with variable binding badges on each property.

Ask: "Collection 3 — Typography is built and 15 text styles are created, all bound to variables. Do the size progressions feel right for your product? Any additional roles needed?"

---

## Collection 4 — Spacing

### Conflict check

Call `mcp__Figma__get_variable_defs`. If "Spacing" collection already exists, ask to overwrite / append / skip.

### Spacing scale preview

Modes: Mobile | Tablet | Desktop (+ Wide if 4-tier). Show before building. All component/layout/inset/stack/touch values alias to Collection 1 spacing primitives.

```
Collection: Spacing
Modes: Mobile | Tablet | Desktop

— Component (padding, gaps within components) —
space/component/xs    Mobile: 4    Tablet: 4    Desktop: 4
space/component/sm    Mobile: 8    Tablet: 8    Desktop: 8
space/component/md    Mobile: 12   Tablet: 16   Desktop: 16
space/component/lg    Mobile: 16   Tablet: 20   Desktop: 24
space/component/xl    Mobile: 20   Tablet: 24   Desktop: 32

— Layout (gaps between components, section padding) —
space/layout/xs       Mobile: 16   Tablet: 24   Desktop: 32
space/layout/sm       Mobile: 24   Tablet: 32   Desktop: 48
space/layout/md       Mobile: 32   Tablet: 48   Desktop: 64
space/layout/lg       Mobile: 48   Tablet: 64   Desktop: 96
space/layout/xl       Mobile: 64   Tablet: 96   Desktop: 128

— Inset (outer margins, page padding) —
space/inset/default   Mobile: 16   Tablet: 24   Desktop: 32
space/inset/wide      Mobile: 24   Tablet: 48   Desktop: 80
space/inset/narrow    Mobile: 12   Tablet: 16   Desktop: 24

— Stack (vertical rhythm between text blocks) —
space/stack/xs        Mobile: 4    Tablet: 4    Desktop: 4
space/stack/sm        Mobile: 8    Tablet: 8    Desktop: 8
space/stack/md        Mobile: 16   Tablet: 16   Desktop: 16
space/stack/lg        Mobile: 24   Tablet: 24   Desktop: 32
space/stack/xl        Mobile: 32   Tablet: 40   Desktop: 48

— Touch targets (accessibility critical) —
space/touch/min         Mobile: 44   Tablet: 44   Desktop: 32
space/touch/comfortable Mobile: 48   Tablet: 48   Desktop: 40

— Border radius (all modes same — hardcoded, not aliased) —
space/radius/none    0
space/radius/xs      2
space/radius/sm      4
space/radius/md      8
space/radius/lg      12
space/radius/xl      16
space/radius/2xl     24
space/radius/full    9999   ← pill shape

— Border width (all modes same — hardcoded) —
space/border/hairline    0.5   ← retina-only; for subtle dividers on high-DPI
space/border/default     1
space/border/medium      2
space/border/thick       4
```

> ⚠️ **Accessibility — WCAG 2.5.5 / 2.5.8**: All interactive elements (buttons, links, checkboxes, toggles) must have a minimum touch target of **44×44px on mobile**. The `space/touch/min` token enforces this. Never rely on component padding alone to determine the clickable area.

### Build Collection 4

1. Create "Spacing" collection with Mobile, Tablet, Desktop modes.
2. Component/layout/inset/stack/touch values alias to Collection 1 spacing primitives.
3. Border radius and border width are hardcoded (they don't follow the spacing scale).
4. `mcp__Figma__get_screenshot` to verify.

Ask: "Collection 4 — Spacing is built. Do the spacing values feel right for your product density? Any missing roles (grid gutters, column count variables)? Next up is Collection 5 — Elevation."

---

## Collection 5 — Elevation

### Conflict check

Call `mcp__Figma__get_variable_defs`. If shadow primitive variables already exist in "Primitives", or if Effect Styles named `elevation/*` exist, ask to overwrite / append / skip.

### Elevation scale preview

6 levels. Each level gets one Figma Effect Style with shadow properties bound to the primitive variables from Collection 1.

```
elevation/0   no shadow (flat surfaces — page bg, inline elements)
elevation/1   xs: cards at rest, resting buttons
elevation/2   sm: card hover, popovers, dropdowns, tooltips
elevation/3   md: drawers, sidebars, side sheets
elevation/4   lg: modals, dialogs, full-screen overlays
elevation/5   xl: toasts, snackbars, floating actions
```

Shadow values (key shadow + ambient shadow for levels 2–5):

```
Level   offsetY   radius   ambient-radius   color
0       —         —        —                —
1       1px       2px      —                color/shadow/key
2       4px       8px      8px              color/shadow/key + color/shadow/ambient
3       8px      16px     12px              color/shadow/key + color/shadow/ambient
4      12px      24px     16px              color/shadow/key + color/shadow/ambient
5      16px      32px     20px              color/shadow/key + color/shadow/ambient
```

All `offsetX = 0`. All `spread = 0` (no `clipsContent` requirement).

Shadow colors alias `color/shadow/key` and `color/shadow/ambient` from Collection 2 — elevation shadows automatically shift in dark mode.

### Build Collection 5

1. The FLOAT shadow primitive variables (`shadow/*/offset-y`, `shadow/*/radius`, `shadow/ambient/*/radius`) were created as part of Collection 1 (1A-iii). Verify they exist before proceeding.
2. The COLOR shadow aliases (`color/shadow/key`, `color/shadow/ambient`) were created in Collection 2. Resolve their variable IDs.
3. Call `run_skill_script("fig-setup/scripts/create-elevation-styles.js")` then run result via `use_figma` to create `elevation/0` through `elevation/5` with bound variables.

> ⚠️ **Binding order matters**: each `setBoundVariableForEffect` call takes the *previous call's return value* as input. `bindEffectField` in the script wraps this safely — do not modify the call chain.

4. Verify: `mcp__Figma__get_screenshot` — the Styles panel should show 6 Effect Styles (`elevation/0` through `elevation/5`) with variable binding badges on `offsetY`, `radius`, and `color`.

5. Read back to confirm bindings were applied: run `use_figma` with a short snippet that calls `figma.getLocalEffectStyles()`, filters by `s.name.startsWith('elevation/')`, and returns `{ name, effectCount, boundVars }` for each style.

Ask: "Collection 5 — Elevation is built. 6 Effect Styles created with `offsetY`, `radius`, and `color` bound to variables. Apply elevation styles to components via `effectStyleId`. Shadow color shifts automatically in dark mode via `color/shadow/key` / `color/shadow/ambient`. Does the shadow scale feel right? Any adjustments?"

---

## Post-Setup Checklist

```
✅ Design System Bootstrap Checklist — [Project Name]

FIGMA SETUP
□ Collection 1 (Primitives) — hidden from publishing ✓ (includes scrim + shadow primitives)
□ Collection 2 (Color/Semantics) — published to team library (includes scrim + shadow semantic tokens)
□ Collection 3 (Typography) — published to team library
□ Collection 4 (Spacing) — published to team library
□ Collection 5 (Elevation) — Effect Styles panel shows elevation/0 through elevation/5 with variable badges
□ Text Styles created for all 15 type roles (display/lg–sm, headline/lg–sm, title/lg–sm, body/lg–sm, label/lg–sm) — each property bound to Typography variables
□ Color Styles created for brand colors

ACCESSIBILITY
□ All text/bg pairings verified ≥ 4.5:1 (WCAG 2.2 AA)
□ All large text / icon pairings verified ≥ 3:1
□ Dark mode pairings verified (APCA is stricter for light-on-dark)
□ Touch targets ≥ 44×44px enforced via space/touch tokens
□ Focus color (color/border/focus or color/outline/focus) verified ≥ 3:1 against adjacent bg
□ Warning yellow verified — this commonly fails; check all text/warning pairings

DEV HANDOFF
□ Export format agreed: [CSS custom properties / design tokens JSON / other]
□ Naming convention documented
□ Token pipeline configured (Tokens Studio / Style Dictionary / other)
□ Breakpoints documented: [values from intake]

NEXT (separate work — not in this skill)
□ Component tokens (button, input, card, etc.) → use /fig-create
□ Motion/animation tokens (duration, easing)
□ Shadow/elevation tokens
□ Grid/layout tokens (column count, gutter, max-width per breakpoint)
□ Icon size tokens
```

---

## Optional: Token Showcase

Ask: "Want me to build a visual token showcase in Figma? It creates a reference frame with your color scales, typography scale, and spacing scale — all bound to your variables. You can skip this."

If yes:

### Showcase — ground rule

**Zero hardcoded values.** Every fill, gap, border width, corner radius, and typography property in the showcase must be bound to a variable. Exceptions (structural sizes like swatch dimensions 56×56 or bar height 24) must be explicitly noted inline.

### Showcase setup

1. Check if a `00 · Tokens` page exists via `use_figma`. If not, create it with `figma.createPage()` and set as current page.
2. Build a vertical auto-layout frame named `Token Showcase — [Project Name]`.

**For every `use_figma` call in the showcase phase**, use `run_skill_script` with an array: `["shared/parse-variables.js", "shared/bind-helpers.js", "fig-setup/scripts/showcase-NAME.js"]`. This bundles shared utilities and the showcase script in a single opaque call — do not read the scripts individually.

**The outer frame uses the design system:**
- Background fill: bound to `color/bg/default` semantic variable via `setBoundVariableForPaint`
- Vertical gap (`itemSpacing`): bound to `space/layout/md` via `frame.setBoundVariable('itemSpacing', var)`
- Section padding: `paddingTop/Bottom/Left/Right` each bound to `space/layout/sm`
- Section header labels: `type/headline/sm` text style via `textNode.textStyleId`
- Step/role/token name labels: `type/label/md` text style

### Color section A — primitive ramps

Each color ramp = one horizontal auto-layout row. Each step = a vertical swatch column:

Call `run_skill_script(["shared/parse-variables.js", "shared/bind-helpers.js", "fig-setup/scripts/showcase-color.js"])` then run result via `use_figma` — Section A (primitive ramps).

Each step shows: color swatch + step name + hex value. No contrast badges — primitives have no inherent accessibility value without a pairing context. The contrast analysis for which steps are safe to use as text was already shown in the Phase 1A preview.

### Color section B — semantic pairs

Shows the actual bg/text pairings the design system enforces. Each row = one semantic pair.

Call `run_skill_script(["shared/parse-variables.js", "shared/bind-helpers.js", "fig-setup/scripts/showcase-color.js"])` then run result via `use_figma` — Section B (semantic pairs).

Switching the showcase frame's Color/Semantics mode (Light ↔ Dark) updates all semantic swatches live — this is the visual test the showcase is designed for.

### Typography section — use Text Styles

Call `run_skill_script(["shared/parse-variables.js", "shared/bind-helpers.js", "fig-setup/scripts/showcase-typography.js"])` then run result via `use_figma`.

The text style handles all font property bindings. Text fill must still be explicitly bound to a semantic color variable.

### Spacing section — widths bound to variables

Call `run_skill_script(["shared/parse-variables.js", "shared/bind-helpers.js", "fig-setup/scripts/showcase-spacing.js"])` then run result via `use_figma` (spacing bars, border radius, and border width sections are all handled by this script).

### Border radius section

Each `space/radius/*` token = one rounded rectangle (built by showcase-spacing.js — see above).

### Border width section

Each `space/border/*` token = one outlined rectangle with no fill (built by showcase-spacing.js — see above).

### Scrim section

Shows each semantic scrim token as a before/after demo: content bg alone vs. content bg + scrim layered on top. Uses multiple fills on a single frame (Figma stacks fills top-to-bottom).

Call `run_skill_script(["shared/parse-variables.js", "shared/bind-helpers.js", "fig-setup/scripts/showcase-scrim.js"])` then run result via `use_figma`.

Switching Light ↔ Dark mode on the frame changes the scrim value (e.g. hover switches from `scrim/black/8` to `scrim/white/8`) — this is the live test.

### Elevation section

One card per elevation level, each with the corresponding Effect Style applied.

Call `run_skill_script(["shared/parse-variables.js", "shared/bind-helpers.js", "fig-setup/scripts/showcase-elevation.js"])` then run result via `use_figma`.

Switching Light ↔ Dark mode changes the shadow color via `color/shadow/key` and `color/shadow/ambient` — dark mode uses white-based scrims (`scrim/white/20` / `scrim/white/8`) to create a subtle light glow effect. Black shadows on dark surfaces have near-zero contrast and are invisible; white shadows simulate a light source lifting the surface above the canvas.

### Final

`mcp__Figma__get_screenshot` to show the completed showcase. Switching the frame's Color/Semantics mode (Light ↔ Dark) must update all fills, scrim overlays, and shadow colors visibly — if anything stays static, a binding is missing.

Pre-flight component API rules (FILL sizing, appendChild order, async collection calls) apply to all `use_figma` calls in this phase.

---

## Runtime Rules

- **Never skip the intake phase.**
- **Always alias, never hardcode** in Collections 2–4. If you catch yourself writing a hex value in Collection 2+, stop and find the right primitive.
- **WCAG first, APCA annotated.** WCAG 2.2 AA is the compliance floor. APCA is the forward-looking quality signal. Both belong in your output.
- **Mobile-first means mobile values are the default.** Tablet and Desktop modes are progressive enhancements.
- **Be explicit about trade-offs.** If a brand color fails contrast at a given step, say so clearly. Do not silently pick a "close enough" value. Flag it and let the designer decide.
- **One collection at a time.** Confirm before proceeding. The user controls the pace.
- **This skill is standalone.** No other figlets skill is required before or after. Suggest `/fig-create` only if the user asks about building components on top of this foundation.
