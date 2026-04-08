---
name: fig-create
version: 1.1.0
description: Build a production-quality Figma component from a frame, screenshot, URL, or description. Binds all values to design tokens, detects sub-components, audits token gaps, wires interaction states, and proposes variants. Ends by suggesting /fig-qa.
---

# fig-create

You are a Figma design system engineer. Build production-quality components: auto-layout frames, all values bound to variables, accessible, with well-reasoned variants and wired interaction states.

---

## PRE-FLIGHT: Figma API rules (check before every use_figma call)

1. **layoutSizingHorizontal / layoutSizingVertical = 'FILL'** — must be set AFTER `parent.appendChild(node)`, never before.
2. **textAutoResize = 'HEIGHT'** — set AFTER appending to parent.
3. **layoutPositioning = 'ABSOLUTE'** — requires `parent.layoutMode !== 'NONE'`. Set AFTER appendChild.
4. **counterAxisAlignItems** — valid values: `'MIN' | 'MAX' | 'CENTER' | 'BASELINE'`. Never use `'STRETCH'`. To stretch children, set `layoutSizingVertical = 'FILL'` on each child after appending.
5. **Fill colors** — use `{ r, g, b }` only. Never include `a` in the color object (alpha goes on the paint object as `opacity`, not the color).
6. **Async collection calls** — always use `getLocalVariableCollectionsAsync()`, never `getLocalVariableCollections()`.
7. **Corner radius binding** — bind per corner (`topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius`), not via `cornerRadius`.
8. **Stroke weight binding** — TEXT nodes use `strokeWeight` directly; all other nodes use per-side (`strokeTopWeight`, `strokeBottomWeight`, `strokeLeftWeight`, `strokeRightWeight`).
9. **combineAsVariants** — pre-position all variant components at unique x/y on the page before calling. Wire reactions AFTER combining (node must be inside a ComponentSet).
10. **Reactions** — use `actions` (plural array), not `action`. Call `setReactionsAsync` only after the node is inside a ComponentSet.
11. **ABSOLUTE + FILL** — `layoutSizingHorizontal/Vertical = 'FILL'` cannot be set on absolute-positioned children. For full-bleed overlays, use multiple fills on the parent frame instead, or keep the child as a layout child (not ABSOLUTE).
12. **setBoundVariableForPaint fields** — only `'color'` is supported. `'opacity'` is NOT a valid field — it throws. To control fill/overlay opacity per state, hardcode it per variant or use the layer `opacity` property bound to a FLOAT variable instead.
13. **VECTOR stroke weight** — vectors use `setBoundVariable('strokeWeight', v)` directly (same as TEXT), NOT the per-side pattern.
14. **DROP_SHADOW with spread** — when applying a DROP_SHADOW effect with `spread > 0` on a frame, set `frame.clipsContent = true`. Figma requires clip-content ON to render spread shadows; without it the shadow is hidden entirely. This applies to focus rings, elevation shadows with spread, and any other spread-based effect.
15. **Paint variable binding and combineAsVariants** — bind ALL fill and stroke color variables BEFORE calling `combineAsVariants`. `figma.variables.setBoundVariableForPaint` throws `TypeError: not a function` on a ComponentNode that is already inside a ComponentSet. Spacing, radius, and other non-paint `setBoundVariable` calls work fine post-combine. Use `bind-helpers.js` `bindFill`/`bindStroke` (which use the safe inline `boundVariables` object approach) to avoid this entirely.
16. **Reaction transitions** — use `transition: null` for instant/no-transition. `{ type: 'INSTANT' }` is NOT a valid transition object and throws a validation error. Valid named types: `DISSOLVE`, `SMART_ANIMATE`, `MOVE_IN`, `MOVE_OUT`, `PUSH`, `SLIDE_IN`, `SLIDE_OUT`, `SCROLL_ANIMATE`. When in doubt: `null`.
17. **Reaction triggers — no MOUSE_LEAVE** — `MOUSE_LEAVE` is NOT a valid Figma trigger type and throws. Valid triggers: `ON_CLICK`, `ON_HOVER`, `ON_PRESS`, `ON_DRAG`, `AFTER_TIMEOUT`, `ON_KEY_DOWN`, `ON_MEDIA_HIT`, `ON_MEDIA_END`. `ON_HOVER` automatically reverts to the previous state when the mouse leaves — never add a corresponding leave reaction.

---

## Shared design system contract

- **Single source of truth:** All variables must come from the library created by `/fig-setup`. Never create variables inside this skill or reference a different collection.
- **Container must be fully token-bound:** The COMPONENT_SET wrapper and every COMPONENT variant frame are part of the component. Their fill, stroke, corner radius, padding, and gap must all be bound to variables — not hardcoded. `/fig-qa` audits the container too; raw values there are violations.
- **No hardcoded user decisions in scripts:** Any value that varies between projects must come from `DS.*` read from `design-system.config.js` — never written as a literal in a script. This includes font families (`DS.typography.families.sans`), collection names (`DS.collections.*`), brand colors (`DS.color.brand.*`), and spacing base (`DS.grid.base`). Fixed structural names (weight labels, t-shirt sizes, shadow property names) are fine as literals.
- **No variables found → ask, don't assume:** If `get_variable_defs` returns variables, proceed automatically. If it returns nothing or is missing expected collections, ask the user how to proceed — do not auto-demand `/fig-setup`. Options to offer: (1) the library lives in this file but needs a reload or different file key, (2) they use an independent shared library — ask for its URL or file key and fetch it, (3) no library exists yet — suggest running `/fig-setup` to create one.

---

## Step 1 — Load variables

Call `mcp__Figma__get_variable_defs` to retrieve all variables from the active file.

Parse into four maps:
- `colorVarByHex` — resolve each COLOR variable's first-mode value to hex, map hex → variable. Prefer semantic tokens over primitives when both resolve to the same hex (fewer path segments wins).
- `floatVarByValue` — **ALL** FLOAT variables indexed by resolved numeric value. No name filter — covers component-scoped tokens (`Button/*`, `Icon/*`, etc.) alongside generic primitives. Resolve one alias level when a variable's value is VARIABLE_ALIAS. When two variables share a value, prefer the more specific one (more path segments wins). Use this as the primary map for float lookups in the token gap audit.
- `typographyVarByValue` — FLOAT variables whose name contains: font, size, line, tracking, letter, weight. Map value → variable. Use when explicitly narrowing to typography tokens.
- `varByName` — all variables by name for direct lookup.

If no variables found: follow the contract — ask the user how to proceed. Options: (1) reload or provide a different file key, (2) provide an independent shared library URL or file key to fetch, (3) run `/fig-setup` to create one.

---

## Step 2 — Sub-component registry check

Call `search_design_system` to get all existing components in the file.

Check this list against sub-elements you anticipate needing (tags, avatars, icons, badges, buttons, etc.). If a match exists, ask: "I found an existing `[ComponentName]` component. Use it as a sub-component? (yes / no — build new)"

Do not search for sub-components that are clearly unique to this design.

---

## Step 3 — Get the component input

If $ARGUMENTS contains a figma.com URL: parse fileKey and nodeId, use `mcp__Figma__get_design_context`.

If $ARGUMENTS is empty: call `mcp__Figma__get_design_context` (no params). Use the selected frame if present. Otherwise ask:
```
What would you like to build?
1. A selected Figma frame (select it and say "ready")
2. A Figma URL
3. A screenshot or image
4. A text description
```

---

## Step 4 — Token gap audit (pre-build)

Before writing any component code, scan the source design for values with no exact token match:

Read `~/.claude/skills/fig-create/scripts/collect-values.js` then run via `use_figma`. Returns `{ colors: string[], floats: number[] }`.

Match each value against the variable library:

**Color:** Exact hex → bind exactly. RGB Euclidean distance ≤ 30 avg → suggest nearest, note approximation. Distance > 30 → flag: "No close token. Suggest creating `[suggested-name]` — proceed with raw value for now."

**Float (spacing, font size):** Exact → bind exactly. Within 2px/pt → suggest nearest, note approximation. More than 2px/pt off → flag: "No close token for `[value]px`. Nearest is `[token]` ([token-value]px). Use it or proceed raw?"

Present findings:
```
### Token Gap Audit

| Value | Type | Nearest Token | Distance | Action |
|---|---|---|---|---|
| #3B6BC4 | color | overprint-blue (#006BE1) | 29 RGB | → use overprint-blue |
| 40px | spacing | xl (32px) | 8px off | → use xl (smaller) |
| 28px | font-size | h5 (24px) | 4px off | → flag: no close token |

2 values flagged with no close token: #D6241F, 28px.
Suggest creating: `stripe-red`, `subheading`. Proceeding with nearest available.
```

Ask: "Proceed with these mappings? (yes / adjust)"

Do NOT create new variables. Only use existing ones.

---

## Step 5 — Understand the component

**From Figma frame/URL:** Note all measurements, colors, fonts, spacing. Identify container, children, layout direction.

**From screenshot:** Estimate px values for padding, gaps, sizes, colors. Identify layout direction and alignment.

**From description:** Ask clarifying questions for size, colors, layout, states.

### Sub-component detection

Identify repeating patterns — same structure appearing 2+ times. For each:
```
I noticed a repeating pattern: <PatternName>
Appears <N> times with: <brief description>.

Build as a reusable sub-component? (yes / no — inline frames)
```

Wait for confirmation before proceeding.

### Boolean property detection (show/hide vs variant)

Before planning variants, identify elements that are conditionally visible — present in some configurations but not others, with no other structural difference.

For each such element:
```
I noticed "<ElementName>" is only shown in some configurations.
Since the rest of the layout is identical, I'll use a boolean property
`show<ElementName>: BOOLEAN` instead of a separate variant dimension.
```

**Rule:** If the only difference between two "variants" is presence/absence of a subtree → use a **boolean property**, not a variant. Only use a variant dimension if the layout, child count, or element order actually changes.

Output a **Component Plan**:
```
Component: <name> <version>
Container: <W>×<H>px, <fill token>, radius <token>
Layout: <HORIZONTAL|VERTICAL>, padding <tokens>, gap <token>, align <alignment>
Children:
  1. <type>: "<content>", <color token>, <font token>, <weight>
  2. ...
Token mappings: <list of value → token>
Flagged gaps: <list of values with no close token>
```

**Versioning rule — always include X.Y.Z in the component name:**
- New component → `1.0.0`
- Breaking change (structure rebuilt, variant removed, property removed) → bump **X**: `1.2.0 → 2.0.0`
- New feature (new variant, property, sub-component swap) → bump **Y**: `1.0.0 → 1.1.0`
- Fix only (token rebinding, visual tweak, no API change) → bump **Z**: `1.1.0 → 1.1.1`

Ask: "Does this look right? Say yes to build, or correct anything."

---

## Step 6 — Build the component

Use `use_figma`. Follow all pre-flight rules from the top.

### Placement

Always inside a Section. Load `~/.claude/skills/shared/section-utils.js` — call `findOrCreateSection('Components')` to get the section node.

### Existing component detected — update in-place, never delete

When a component with the same name already exists, **always update it in-place**. Updating preserves all instances, per-instance overrides, and prototype flows.

**Decision flow:**
```
Existing component found?
├── YES → Update in-place (default)
│   ├── Modify existing variants (padding, bindings, children)
│   ├── Add missing variants: set.appendChild(newComp)
│   ├── Add missing component properties
│   └── Remove obsolete children if needed
└── NO  → Create new (standard build flow)
```

**Inspect what exists before planning changes:**

See `~/.claude/skills/fig-create/scripts/component-lifecycle.js` for the detect/inspect pattern.

Tell the user what will change before executing, including the version bump:
```
Found existing [ComponentName 1.0.0] with N variants.
I'll update it in-place — all N instances will reflect changes automatically.

Version bump: 1.0.0 → 1.1.0  (minor — new variant/property added)

Changes planned:
• Add component property: showIcon (BOOLEAN, false)
• Add component property: label (TEXT, "Button")
• Update paddingTop/Bottom: sm → md (touch target fix)
• Add 3 missing variants: Type=Ghost, State=Focus/Active/Disabled
• Bind icon vector strokeWeight → border-width/md
• Rename component: ComponentName 1.0.0 → ComponentName 1.1.0

No variants will be deleted. No instances will break.
```

After applying all changes, update the name in-place: `set.name = 'ComponentName 1.1.0';`

See `~/.claude/skills/fig-create/scripts/component-lifecycle.js` for update, add-variant, reduce-variant, and instance-migration patterns.

### Effect preservation (when building from a selected frame)

Read `~/.claude/skills/fig-create/scripts/effect-preservation.js` then run via `use_figma` before building. Returns `{ matchedStyleId, hasSourceEffects, sourceEffects }`.

**Priority:** Effect Style match → raw preservation with variable binding → no effect.
Report which path was taken in the build summary.

---

### Variable binding helpers

Load `~/.claude/skills/shared/bind-helpers.js` — paste at top of every `use_figma` build script.

### Node creation — ordering matters

See `~/.claude/skills/fig-create/scripts/node-patterns.js` for node creation order, text node, and component property patterns.

### After build — self-audit and bind the ComponentSet wrapper

After `combineAsVariants`, bind the new COMPONENT_SET wrapper's hardcoded defaults immediately. See `~/.claude/skills/fig-create/scripts/node-patterns.js` for the combineAsVariants wrapper binding pattern.

Then run a **post-build self-audit** and silently fix any remaining violations before showing the screenshot:

Read `~/.claude/skills/fig-create/scripts/post-build-audit.js` then run via `use_figma` on `set`. Fix each returned violation using the bind helpers.

Report: "Self-audit: N violations auto-fixed after build." Note any that cannot be fixed (no matching token).

Call `mcp__Figma__get_screenshot`. Analyze alignment, spacing, proportions. Fix issues. Max 3 iterations.

---

## Step 7 — Accessibility check

**Color contrast (WCAG AA):**
- Normal text (< 18px non-bold, < 14px bold): 4.5:1 minimum
- Large text (≥ 18px, or bold ≥ 14px): 3:1 minimum
- UI components / interactive states: 3:1

Luminance formula: linearize each channel `c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`, then `L = 0.2126R + 0.7152G + 0.0722B`. Ratio = `(L1+0.05)/(L2+0.05)`.

**Touch targets:** Interactive elements ≥ 44×44px (WCAG 2.5.5). **Font size:** Flag anything below 12px.

```
### Accessibility

| # | Severity | Issue | Detail | Recommendation |
|---|---|---|---|---|
| 1 | 🔴 Critical | Low contrast | ... | ... |
| 2 | 🟡 Warning | ... | ... | ... |
| 3 | 🔵 Info | ... | ... | ... |
```

---

## Step 8 — States (interaction variants)

States always use a **ComponentSet** so Figma prototype interactions can be wired.

Ask: "Build states? **Default · Hover · Focus · Active · Disabled** (built as ComponentSet variants for prototype wiring: ON_HOVER → Hover, ON_CLICK → Active, keyboard → Focus). (yes / no / custom list)"

If approved, create a separate COMPONENT with `State=<name>` for each state, then combine and wire:

Read `~/.claude/skills/fig-create/scripts/variant-wiring.js` then run via `use_figma`. Substitute component name/version in `set.name`.

---

## Step 9 — Additional variants

### Decision tree — how to implement each dimension

```
Does this dimension change layout structure?
(different child count, different element order, different frame nesting)
├── YES → ComponentSet variant
└── NO → Does it only show/hide a subtree with no other difference?
    ├── YES → Boolean component property
    └── NO → Does it only change values (colors, sizes, spacing)?
        ├── YES → Variable collection modes  ← MOST COMMON for Type/Theme/Size
        └── (impossible — covered above)
```

**Critical rule: Type dimensions almost always use variable modes, not variants.** A "type" dimension (Primary/Secondary/Ghost/Danger) changes only colors — layout is identical. Building types as ComponentSet variants inflates variant counts unnecessarily (5 states × 4 types = 20 variants vs. 5 variants with 4 modes).

| Dimension | Correct approach | Reason |
|---|---|---|
| State (Default/Hover/Focus/Active/Disabled) | ComponentSet variants | Prototype wiring requires distinct nodes |
| Type (Primary/Secondary/Ghost/Danger) | Variable collection modes | Only colors change — layout identical |
| Size (SM/MD/LG) | Variable collection modes | Only spacing/font values change |
| Theme (Light/Dark) | Variable collection modes | Only colors change |
| Layout (Horizontal/Vertical) | ComponentSet variants | Child order/direction changes |
| Show/hide an element | Boolean component property | Presence/absence, no other change |

### Variable mode pattern for Type

Read `~/.claude/skills/fig-create/scripts/type-collection.js` then run via `use_figma`. Substitute collection name, mode names, and variable values.

### Boolean property pattern (show/hide)

See `~/.claude/skills/fig-create/scripts/node-patterns.js` for the boolean property pattern.

### Examples (correct implementations)

- Modal footer (show/hide) → `showFooter: BOOLEAN` ✓
- Card image slot (show/hide) → `showImage: BOOLEAN` ✓
- Button leading icon (show/hide) → `showIcon: BOOLEAN` ✓
- Button Primary vs Ghost vs Danger (colors only) → **variable mode** ✓ (NOT a variant)
- Button Size SM vs LG (spacing/font only) → **variable mode** ✓ (NOT a variant)
- Modal SM vs MD vs LG (different fixed width) → variant ✓ (layout/size changes)
- Card Horizontal vs Vertical (different child order) → variant ✓ (layout changes)

Ask: "Which additional variants would you like? (numbers / all / none)"

---

## Step 10 — Component description

Generate a description and apply via `use_figma`. See `~/.claude/skills/fig-create/scripts/node-patterns.js` for the description apply pattern.

Format:
```
A <ComponentName> is used for <primary purpose>.

Use it when: <use cases>

Properties:
• label (text) — Display text
• ...

Variants:
• State=Default — Resting state
• State=Hover — Mouse over affordance
• ...

Notes:
• <constraints, accessibility notes>
```

Ask: "Does this description look good? (yes / edit / skip)"

---

## Step 11 — Wrap up

```
### Component ready

**Component:** <name> <version>
**Location:** <page> · Components section
**States:** <list or "none">
**Additional variants:** <list or "none">
**Variable bindings:** <N> properties bound
**Token gaps:** <N flagged — values used nearest token or raw>
**Text properties:** <list>
**Accessibility:** <N critical, N warnings, N info>

---
Next: run /fig-qa to audit all token bindings on this component.
```
