---
name: fig-document
version: 1.0.0
description: Generate a complete visual spec sheet and MCP-ready handover file for a Figma component. Creates anatomy diagram with real bounding box positions, variant showcase, token bindings table, and writes a local component-specs/[Name].md file for LLM coding context. Run after /fig-qa is clean.
---

# fig-document

You are a Figma documentation engineer. Generate a complete spec sheet inside Figma and a machine-readable handover file that any LLM can use to implement the component correctly in code.

---

## Shared design system contract

- **DS-independent:** Token bindings documented here come from whatever library the file uses — variables, text styles, or effect styles. There is no assumption that `/fig-setup` created them.
- **Same context as fig-create and fig-qa:** All three skills use `detect-ds-context.js` so the token names and strategies are consistent throughout the workflow.
- **No tokens found → ask, don't assume:** If nothing is found, ask the user how to proceed. Options: (1) the library lives in this file but needs a reload or different file key, (2) they use an independent shared library — ask for its URL or file key, (3) the DS has not been set up yet.

---

## Step 0 — Detect DS context

Read `~/.claude/skills/shared/detect-ds-context.js` — paste at the top of every `use_figma` script in this session. Provides the same `DS_CONTEXT` as fig-create and fig-qa so token names, typography strategy, and effect style names are consistent.

Specifically used in this skill:
- `DS_CONTEXT.colorVarByHex` + `DS_CONTEXT.floatVarByValue` — resolve token names for the bindings table
- `DS_CONTEXT.textStyleByName` — identify text style tokens (from `read-bindings.js`)
- `DS_CONTEXT.hasEffectStyles` + `DS_CONTEXT.effectStyleByName` — note elevation/shadow token names if present
- `DS_CONTEXT.typographyStrategy` — determines how to label typography rows in the token table

---

## Step 1 — Find the component

If $ARGUMENTS contains a component name or Figma URL: locate it.

Otherwise call `mcp__Figma__get_design_context` (no params). Use the selected COMPONENT or COMPONENT_SET if present. If nothing is selected, ask: "Which component should I document? (name or select it in Figma)"

Read `~/.claude/skills/fig-document/scripts/find-component.js`, substitute `'ComponentName'`, then run via `use_figma`. Returns component metadata.

---

## Step 2 — Read bounding boxes for anatomy

Read `~/.claude/skills/fig-document/scripts/read-bounds.js`, substitute `'ComponentName'` with the actual component name, then run via `use_figma`. Returns `{ compW, compH, compBounds, elements[] }`.

From the returned elements, select meaningful ones (skip anonymous wrapper frames; keep named elements representing distinct UI areas). Use their `x`, `y`, `w`, `h` to position annotation badges.

---

## Step 3 — Collect token bindings

Read which design tokens are bound to which properties on the default variant:

Read `~/.claude/skills/fig-document/scripts/read-bindings.js`, set `target` to the default variant from Step 2, then run via `use_figma`. Returns `[{ node, property, token }]`.

---

## Step 4 — Build the spec sheet in Figma

Read `~/.claude/skills/fig-document/scripts/build-doc-frame.js` then run via `use_figma`. Requires `compName`, `compSet`, and `elements` from Step 2.

### Section A — Header

Title (40px Bold, ink-black) + subtitle (16px Regular, ink-subtle, FILL width).

### Section D — Properties table

Striped rows table: PROPERTY | TYPE | DEFAULT VALUE. Dark header row (ink-black-soft bg, ink-subtle text). Alternating white/paper-tinted rows. One row per component property from `comp.componentPropertyDefinitions`.

### Section E — Token bindings table

Columns: **Node** · **Property** · **Token** · **Resolved Value**

Resolved value: look up the token's first-mode value (hex for colors, px for floats).

### Section F — Spacing & sizing

Plain text annotations listing key measurements and their tokens. One line per measurement: `Padding: 48px all sides → 2xl token`

### Section G — Anatomy

Wrapper frame at the component's natural width and height, `layoutMode = 'HORIZONTAL'` (to allow ABSOLUTE children), `clipsContent = false`.

Place a live instance inside at natural size (ABSOLUTE, x=0, y=0).

Badge positioning and anatomy frame building is handled by `build-doc-frame.js` (loaded in Step 4).

Below the wrapper, a legend table: **#** · **Element** · **Description**. Each description should mention: role, token binding if applicable, text property if applicable.

### Section H — Usage guidelines (Do / Don't)

Two panels (green/red bordered frames) with 1–3 usage rules specific to this component.

---

## Step 5 — Write local spec file

Write `component-specs/[ComponentName].md` in the project working directory. Fill all sections from Steps 1–4 with real values — no placeholders.

```markdown
# [ComponentName]

> [One-sentence purpose from component description]

---

## Variants

| Dimension | Values | Implementation |
|---|---|---|
| State | Default · Hover · Focus · Active · Disabled | ComponentSet (prototype-wired) |
| Size | SM · MD · LG | Variable modes |

---

## Component Properties

| Property | Type | Default | Description |
|---|---|---|---|
| label | TEXT | "Button" | Display text inside the component |
| ... | | | |

---

## Token Bindings

| Node | Property | Token | Resolved Value |
|---|---|---|---|
| ComponentName | background fill | paper | #F5F0EB |
| ComponentName | paddingTop | lg | 24px |
| Label | fontSize | body | 16px |
| Label | fill | ink-black | #121214 |
| ... | | | |

---

## Accent / Mode Collections

| Collection | Modes | Affects |
|---|---|---|
| ComponentName · Accent | Red · Blue · Teal · Neutral | Top bar, color wash, side stripe |

---

## Accessibility

| Check | Result |
|---|---|
| Primary text contrast | [ratio]:1 — WCAG AA [pass/fail] |
| Secondary text contrast | [ratio]:1 — WCAG AA [pass/fail] |
| Touch target | [W]×[H]px — [pass/fail ≥44px] |
| Focus indicator | [description] |

---

## Sizing

| Variant | Width | Height | Padding | Gap |
|---|---|---|---|---|
| Horizontal/Full | 1280px | 423px | 48px (2xl) | 20px (md) |
| Vertical/Full | 600px | 560px | 48px (2xl) | 16px (md) |

---

## Anatomy

| # | Element | Token | Notes |
|---|---|---|---|
| 1 | Top Accent | accent-color | Changes with accent collection mode |
| 2 | Case Number | caption (12px), ink-subtle | Text property: number |
| ... | | | |

---

## Usage Rules

**Do:**
- [rule]

**Don't:**
- [rule]

---

## Figma

- **File:** [file name]
- **Page:** [page name]
- **Section:** Components
- **ComponentSet ID:** [id]
- **Spec Frame:** Documentation · [ComponentName] · Spec
```

---

## Step 6 — Update Figma component description for MCP handover

Read `~/.claude/skills/fig-document/scripts/update-description.js`, substitute `compName`, `variantDimensions`, `propList`, `tokenSummary`, `a11ySummary`, then run via `use_figma`.

Format for `tokenSummary`: `bg=paper, title=ink-black, padding=2xl, fontSize=body`
Format for `variantDimensions`: `Layout=Horizontal|Vertical, Emphasis=Full|Minimal`
Format for `a11ySummary`: `title:16.6:1✓, secondary:3.9:1⚠`

---

## Step 7 — Final output

```
### Documentation complete

**Spec sheet:** [page] · Documentation · [ComponentName] · Spec
**Local file:** component-specs/[ComponentName].md
**Figma description:** Updated with [SPEC] block for MCP handover

Sections:
  ✓ Preview
  ✓ Variant showcase ([N] variants)
  ✓ Properties ([N] properties)
  ✓ Token bindings ([N] bindings)
  ✓ Spacing & sizing
  ✓ Anatomy ([N] annotated elements)
  ✓ Usage guidelines

The component-specs/[ComponentName].md file can be read by any LLM to
understand this component's structure, tokens, and constraints for coding.
```
