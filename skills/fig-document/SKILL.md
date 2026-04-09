---
name: fig-document
version: 1.1.0
description: Generate a complete visual spec sheet and MCP-ready handover file for a Figma component. Creates anatomy diagram, variant showcase with per-variant purpose notes, and writes a local component-specs/[Name].md file for LLM coding context. Run after /fig-qa is clean.
---

# fig-document

You are a Figma documentation engineer. Generate a complete spec sheet inside Figma and a machine-readable handover file that any LLM can use to implement the component correctly in code.

---

## PRE-FLIGHT: Figma API rules (apply to every text node in the spec sheet)

1. **Never create bare text nodes directly inside a table row.** Always use `makeCell(row, text, width, style)` from `build-doc-frame.js`. It handles the cell frame, text node, and `textAutoResize` correctly. Rows that contain raw text nodes without proper sizing will render at 1px height and be invisible.
2. **textAutoResize = 'HEIGHT'** — set on text nodes inside fixed-width cells (i.e. all `makeCell` text nodes). `makeCell` does this automatically.
3. **textAutoResize = 'WIDTH_AND_HEIGHT'** — set on free-standing text nodes (section headers, annotations, labels outside tables) AFTER `parent.appendChild(node)`. `makeLabel` does this automatically — use it for all section label text.
4. **layoutSizingHorizontal / layoutSizingVertical = 'FILL'** — set AFTER `parent.appendChild(node)`, never before.

---

## Shared design system contract

- **DS-independent:** Token bindings documented here come from whatever library the file uses — variables, text styles, or effect styles. There is no assumption that `/fig-setup` created them.
- **Same context as fig-create and fig-qa:** All three skills use `detect-ds-context.js` so the token names and strategies are consistent throughout the workflow.
- **No tokens found → ask, don't assume:** If nothing is found, ask the user how to proceed. Options: (1) the library lives in this file but needs a reload or different file key, (2) they use an independent shared library — ask for its URL or file key, (3) the DS has not been set up yet.

---

## Step 1 — Identify the component and get variant names

If $ARGUMENTS contains a component name or Figma URL: use it.

Otherwise call `mcp__Figma__get_design_context` (no params). Use the selected COMPONENT or COMPONENT_SET if present. If nothing is selected, ask: "Which component should I document? (name or select it in Figma)"

Note the component name, then read `~/.claude/skills/fig-document/scripts/find-component.js`, substitute `'ComponentName'` with the actual name, and run it in a `use_figma` call.

Note the exact variant names from the result — you will need them verbatim in Step 2.

---

## Step 2 — Run in ONE use_figma call

Read both scripts **in parallel** (one message, two Read tool calls):
- `~/.claude/skills/shared/detect-ds-context.js`
- `~/.claude/skills/fig-document/scripts/doc-runner.js`

Make exactly **THREE substitutions** in doc-runner.js before running:

1. Replace `'COMPONENT_NAME'` with the actual component name (line 8)
2. Replace the `_usageDo` / `_usageDont` arrays with 2–3 rules specific to this component
3. Replace `const _variantDesc = {};` with a map of **exact variant name → short purpose** (≤10 words each):
   ```js
   const _variantDesc = {
     'Type=Primary, Size=Default': 'High-emphasis action for the most important CTA',
     'Type=Secondary, Size=Default': 'Lower-emphasis alternative alongside a primary button',
     'Type=Ghost, Size=Default': 'Minimal style for tertiary or inline actions',
   };
   ```
   Keys must be the **exact** variant name strings from Step 1 (including spacing and punctuation).
   If a component is not a COMPONENT_SET, pass `{}`.

Concatenate into one script: `[detect-ds-context.js content]\n[doc-runner.js with substitutions]`

Run as a single `use_figma` call. The script handles everything: bounds, bindings (sync), fonts, DS-adaptive palette, doc frame, Sections A–G, and description update.

---

## Step 3 — Write local spec file

Write `component-specs/[ComponentName].md` in the project working directory. Fill all sections from Step 2 with real values — no placeholders.

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

## Step 4 — Final output

```
### Documentation complete

**Spec sheet:** [page] · Documentation · [ComponentName] · Spec
**Local file:** component-specs/[ComponentName].md
**Figma description:** Updated with [SPEC] block for MCP handover

Sections:
  ✓ Preview
  ✓ Variant showcase ([N] variants with purpose notes)
  ✓ Properties ([N] properties)
  ✓ Spacing & sizing
  ✓ Anatomy ([N] annotated elements)
  ✓ Usage guidelines

The component-specs/[ComponentName].md file can be read by any LLM to
understand this component's structure, tokens, and constraints for coding.
```
