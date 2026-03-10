---
name: fig-create
version: 1.0.0
description: Build a production-quality Figma component from a frame, screenshot, URL, or description. Binds all values to design tokens, detects sub-components, audits token gaps, wires interaction states, and proposes variants. Ends by suggesting /fig-qa.
---

# fig-create

You are a Figma design system engineer. Build production-quality components: auto-layout frames, all values bound to variables, accessible, with well-reasoned variants and wired interaction states.

---

## PRE-FLIGHT: Figma API rules (check before every figma_execute call)

These rules are non-negotiable. Violating them causes silent failures or runtime errors.

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

---

## Step 1 — Load variables

Call `mcp__figma-console__figma_get_variables` to retrieve all variables from the active file.

Parse into four maps for use throughout:
- `colorVarByHex` — resolve each COLOR variable's first-mode value to hex, map hex → variable. Prefer semantic tokens over primitives when both resolve to the same hex.
- `spacingVarByValue` — FLOAT variables whose name contains: space, spacing, gap, padding, margin, radius, width, height, border. Map value → variable.
- `typographyVarByValue` — FLOAT variables whose name contains: font, size, line, tracking, letter, weight. Map value → variable.
- `varByName` — all variables by name for direct lookup.

If no variables found: ask for a library file key. If none available, warn that all values will be hardcoded and ask to proceed.

---

## Step 2 — Sub-component registry check

Call `mcp__figma-console__figma_search_components` to get all existing components in the file.

Before building, check this list against any sub-elements you anticipate needing (tags, avatars, icons, badges, buttons, etc.). If an existing component matches:
- Propose reusing it as an instance rather than rebuilding
- Ask: "I found an existing `[ComponentName]` component. Use it as a sub-component? (yes / no — build new)"

Do not search for sub-components that are clearly unique to this design.

---

## Step 3 — Get the component input

If $ARGUMENTS contains a figma.com URL:
- Parse fileKey and nodeId. Use `mcp__claude_ai_Figma__get_design_context` to read the design.
- Also call `mcp__figma-console__figma_get_selection`.

If $ARGUMENTS is empty:
- Check `mcp__figma-console__figma_get_selection`. Use that frame if selected.
- Otherwise ask:
  ```
  What would you like to build?
  1. A selected Figma frame (select it and say "ready")
  2. A Figma URL
  3. A screenshot or image
  4. A text description
  ```

---

## Step 4 — Token gap audit (pre-build)

Before writing any component code, scan the source design for values that have no exact token match. Run via `mcp__figma-console__figma_execute`:

```javascript
// Collect all raw values from the source node
function collectValues(node, results = { colors: new Set(), floats: new Set() }) {
  if (node.type === 'INSTANCE') return results;

  if (node.fills) node.fills.forEach(f => {
    if (f.type === 'SOLID' && !node.boundVariables?.fills?.[0]) {
      const hex = '#' + [f.color.r, f.color.g, f.color.b]
        .map(c => Math.round(c*255).toString(16).padStart(2,'0')).join('');
      results.colors.add(hex);
    }
  });

  ['paddingTop','paddingBottom','paddingLeft','paddingRight','itemSpacing',
   'counterAxisSpacing','fontSize','cornerRadius'].forEach(prop => {
    const val = node[prop];
    if (val && typeof val === 'number' && val !== 0 && !node.boundVariables?.[prop]) {
      results.floats.add(val);
    }
  });

  if ('children' in node) node.children.forEach(c => collectValues(c, results));
  return results;
}

const src = figma.currentPage.selection[0] || figma.currentPage.children[0];
const vals = collectValues(src);
return JSON.stringify({ colors: [...vals.colors], floats: [...vals.floats] });
```

For each collected value, match against the variable library:

**Color matching:**
- Exact hex match → will bind exactly, no flag needed
- RGB Euclidean distance ≤ 30 per channel avg → suggest nearest variable, note the approximation
- Distance > 30 → flag: "No close token. Suggest creating `[suggested-name]` — proceed with raw value for now."

**Float matching (spacing, font size):**
- Exact match → bind exactly
- Within 2px/pt → suggest nearest, note the approximation
- More than 2px/pt off → flag: "No close token for `[value]px`. Nearest is `[token]` ([token-value]px). Use it or proceed raw?"

Present the findings as a table:

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

Analyze the input carefully before planning.

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

Before planning variants, identify any elements that are **conditionally visible** — present in some configurations but not others, with no other structural difference.

For each such element:
```
I noticed "<ElementName>" is only shown in some configurations.
Since the rest of the layout is identical, I'll use a boolean property
`show<ElementName>: BOOLEAN` instead of a separate variant dimension.
This keeps the component set smaller and more flexible.
```

**Rule:** If the only difference between two "variants" is presence/absence of a subtree → use a **boolean property**, not a variant. Only use a variant dimension if the layout, child count, or element order actually changes.

Then output a **Component Plan**:
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
- New component → start at `1.0.0`
- Existing component, breaking change (structure rebuilt, variant removed, property removed) → bump **X** (major): `1.2.0 → 2.0.0`
- Existing component, new feature (new variant, new property, sub-component swap) → bump **Y** (minor): `1.0.0 → 1.1.0`
- Existing component, fix only (token rebinding, visual tweak, no API change) → bump **Z** (patch): `1.1.0 → 1.1.1`

Ask: "Does this look right? Say yes to build, or correct anything."

---

## Step 6 — Build the component

Use `mcp__figma-console__figma_execute`. Follow all pre-flight rules from the top.

### Placement

Always inside a Section:
```javascript
let section = figma.currentPage.findOne(n => n.type === 'SECTION' && n.name === 'Components');
if (!section) {
  section = figma.createSection();
  section.name = 'Components';
  section.x = 0; section.y = 0;
  figma.currentPage.appendChild(section);
}
```

### Existing component detected — update in-place, never delete

When a component with the same name already exists, **always update it in-place** instead of deleting and recreating. Updating preserves:
- All instances in the file (no broken links)
- Per-instance property overrides (text, boolean values)
- Prototype flows that reference the component

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
```javascript
// Search by base name (with or without existing version suffix)
const baseName = 'ComponentName';
const set = figma.currentPage.findOne(n =>
  (n.name === baseName || n.name.match(new RegExp(`^${baseName} \\d+\\.\\d+\\.\\d+$`))) &&
  (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'));

const vMatch = set?.name.match(/(\d+\.\d+\.\d+)$/);
return {
  exists: !!set,
  type: set?.type,
  currentName: set?.name,
  currentVersion: vMatch?.[1] || '(unversioned)',
  variantNames: set?.children?.map(c => c.name),
  propDefs: set?.componentPropertyDefinitions,
};
```

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

After applying all changes, update the name:
```javascript
set.name = 'ComponentName 1.1.0'; // always update the version suffix in-place
```

**Update existing variants:**
```javascript
// Modify properties on an existing variant directly
const variant = set.children.find(n => n.name === 'Type=Primary, State=Default');
if (variant) {
  variant.paddingTop = 16;
  variant.setBoundVariable('paddingTop', mdVar);

  // Add a new child (e.g. icon frame) if missing
  if (!variant.findOne(n => n.name === 'icon')) {
    const iconF = figma.createFrame();
    iconF.name = 'icon';
    // ... configure ...
    variant.insertChild(0, iconF); // insert before label
  }

  // Add a missing component property
  if (!variant.componentPropertyDefinitions['label']) {
    variant.addComponentProperty('label', 'TEXT', 'Button');
  }
}
```

**Add a missing variant to an existing ComponentSet:**
```javascript
// Create the new variant component
const newVariant = figma.createComponent();
newVariant.name = 'Type=Primary, State=Focus';
// ... configure layout, fills, children ...

// Position it temporarily, then append to the existing set
newVariant.x = -99999; newVariant.y = -99999;
figma.currentPage.appendChild(newVariant);

// Append to the existing ComponentSet — no combineAsVariants needed
set.appendChild(newVariant);
```

**Reducing the variant count of an existing ComponentSet** (e.g. collapsing 20 type×state variants into 5 state-only variants):
- NEVER create a new ComponentSet and delete the old one — this changes the node ID and breaks all instances
- Instead, remove unwanted child variants in-place and rename the keepers:

```javascript
// Keep only one type's state variants, remove the rest
const set = figma.currentPage.findOne(n => n.name === 'Button' && n.type === 'COMPONENT_SET');
for (const variant of [...set.children]) {
  if (!variant.name.includes('Type=Primary')) variant.remove(); // remove non-primary
}
// Rename: "Type=Primary, State=Default" → "State=Default"
for (const variant of set.children) {
  variant.name = variant.name.replace('Type=Primary, ', '');
}
// Now bind new type variables to the 5 remaining variants
// ComponentSet node ID is unchanged — all instances stay valid
```

**If a full structural rebuild is unavoidable** (e.g. changing from COMPONENT to COMPONENT_SET, or adding a completely different layer hierarchy):
1. Scan all instances first
2. Build the new component alongside the old one (don't delete yet)
3. Swap all instances: `inst.swapComponent(newSet.children[0])`
4. Only then remove the old component

```javascript
// Instance scan across all pages
await figma.loadAllPagesAsync();
const toMigrate = [];
for (const page of figma.root.children) {
  for (const inst of page.findAll(n => n.type === 'INSTANCE')) {
    const main = await inst.getMainComponentAsync();
    if (main && (main.id === oldComp.id || main.parent?.id === oldComp.id)) {
      toMigrate.push(inst);
    }
  }
}
// Swap then delete
for (const inst of toMigrate) inst.swapComponent(newSet.defaultVariant || newSet.children[0]);
oldComp.remove();
```

### Node creation — ordering matters

```javascript
// 1. Load fonts first
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

// 2. Create node and set non-layout properties
const comp = figma.createComponent();
comp.name = 'ComponentName 1.0.0'; // new components always start at 1.0.0
comp.layoutMode = 'HORIZONTAL';
comp.primaryAxisSizingMode = 'AUTO';
comp.counterAxisSizingMode = 'AUTO';
comp.paddingTop = N; // raw value first
comp.fills = [{ type: 'SOLID', color: { r, g, b } }]; // {r,g,b} only — no 'a'

// 3. Append to parent
section.appendChild(comp);

// 4. Bind variables (after append)
bindFill(comp, 'token-name');
bindNum(comp, 'paddingTop', 'token-name');

// 5. Create children, append, then set FILL sizing
const child = figma.createFrame();
comp.appendChild(child);
child.layoutSizingHorizontal = 'FILL'; // AFTER appendChild
```

### Variable binding helpers

```javascript
const allVars = await figma.variables.getLocalVariablesAsync();
const varByName = {};
allVars.forEach(v => { varByName[v.name] = v; });

function bindFill(node, varName) {
  const v = varByName[varName];
  if (!v || !node.fills?.length) return;
  const fills = JSON.parse(JSON.stringify(node.fills));
  fills[0] = figma.variables.setBoundVariableForPaint(fills[0], 'color', v);
  node.fills = fills;
}

function bindStroke(node, varName) {
  const v = varByName[varName];
  if (!v || !node.strokes?.length) return;
  const strokes = JSON.parse(JSON.stringify(node.strokes));
  strokes[0] = figma.variables.setBoundVariableForPaint(strokes[0], 'color', v);
  node.strokes = strokes;
}

function bindNum(node, prop, varName) {
  const v = varByName[varName]; if (!v) return;
  node.setBoundVariable(prop, v);
}

function bindRadius(node, varName) {
  const v = varByName[varName]; if (!v) return;
  ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
    .forEach(p => node.setBoundVariable(p, v));
}

function bindStrokeWeight(node, varName) {
  const v = varByName[varName]; if (!v) return;
  if (node.type === 'TEXT') {
    node.setBoundVariable('strokeWeight', v);
  } else {
    ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight']
      .forEach(p => node.setBoundVariable(p, v));
  }
}
```

### Text node pattern

```javascript
const label = figma.createText();
label.fontName = { family: 'Inter', style: 'Regular' };
label.characters = 'Label text';
label.fontSize = 16;
label.fills = [{ type: 'SOLID', color: { r, g, b } }];
comp.appendChild(label);           // append first
label.layoutSizingHorizontal = 'FILL'; // then FILL
label.textAutoResize = 'HEIGHT';       // then textAutoResize
bindFill(label, 'ink-black');
bindNum(label, 'fontSize', 'body');
```

### Text component properties

After creating all text nodes, expose each as a component property:
```javascript
comp.addComponentProperty('label', 'TEXT', 'Default text');
const propKey = Object.keys(comp.componentPropertyDefinitions).find(k => k.startsWith('label'));
if (propKey) textNode.componentPropertyReferences = { characters: propKey };
```

### After build — self-audit and bind the ComponentSet wrapper

After `combineAsVariants`, the new COMPONENT_SET wrapper has Figma's hardcoded defaults (5px radius, 20px padding). Always bind these immediately:

```javascript
// After combineAsVariants:
const set = figma.combineAsVariants(variants, pg);
set.name = 'ComponentName 1.0.0'; // new: 1.0.0 | update: bump per versioning rule
// ... set layoutMode, itemSpacing, padding ...

// Bind the wrapper's own tokens
bindRadius(set, 'xs');           // 5px default → xs (4px nearest)
bindNum(set, 'paddingTop',    'md');  // adjust token to match your wrapper padding
bindNum(set, 'paddingBottom', 'md');
bindNum(set, 'paddingLeft',   'md');
bindNum(set, 'paddingRight',  'md');
bindNum(set, 'itemSpacing',   'sm');
try { bindNum(set, 'counterAxisSpacing', 'sm'); } catch(e) {}
```

Then run a quick **post-build self-audit** and silently fix any remaining violations before showing the screenshot:

```javascript
function quickAudit(node, violations = []) {
  if (node.type === 'INSTANCE') return violations;
  // Strokes with unbound color
  (node.strokes || []).forEach((s, i) => {
    if (s.type === 'SOLID' && !node.boundVariables?.strokes?.[i])
      violations.push({ nodeId: node.id, type: node.type, prop: 'Stroke color', strokeIndex: i,
        hex: '#'+['r','g','b'].map(c=>Math.round(s.color[c]*255).toString(16).padStart(2,'0')).join('') });
  });
  // Stroke weight on stroked nodes
  if ((node.strokes||[]).length > 0 && node.strokeWeight && !node.boundVariables?.strokeTopWeight && !node.boundVariables?.strokeWeight)
    violations.push({ nodeId: node.id, type: node.type, prop: 'Stroke weight', value: node.strokeWeight });
  // Corner radius
  if (node.type !== 'TEXT' && node.cornerRadius > 0 && !node.boundVariables?.topLeftRadius)
    violations.push({ nodeId: node.id, type: node.type, prop: 'Corner radius', value: node.cornerRadius });
  // Spacing
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    ['paddingTop','paddingBottom','paddingLeft','paddingRight','itemSpacing','counterAxisSpacing'].forEach(p => {
      if (node[p] && !node.boundVariables?.[p])
        violations.push({ nodeId: node.id, type: node.type, prop: p, value: node[p] });
    });
  }
  if ('children' in node) node.children.forEach(c => quickAudit(c, violations));
  return violations;
}
// Run on the full ComponentSet after build, fix silently, report count
const remaining = quickAudit(set);
// fix each remaining violation using the same bind helpers before screenshot
```

Report: "Self-audit: N violations auto-fixed after build." If any cannot be fixed (no matching token), note them.

### Screenshot and iterate

Call `mcp__figma-console__figma_take_screenshot`. Analyze alignment, spacing, proportions. Fix issues. Max 3 iterations.

---

## Step 7 — Accessibility check

After building, check:

**Color contrast (WCAG AA):**
- Normal text (< 18px non-bold, < 14px bold): 4.5:1 minimum
- Large text (≥ 18px, or bold ≥ 14px): 3:1 minimum
- UI components / interactive states: 3:1

Luminance formula: linearize each channel `c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`, then `L = 0.2126R + 0.7152G + 0.0722B`. Ratio = `(L1+0.05)/(L2+0.05)`.

**Touch targets:** Interactive elements ≥ 44×44px (WCAG 2.5.5).

**Font size:** Flag anything below 12px.

Output:
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

Propose states appropriate to the component type:

```
### Proposed States

**Default · Hover · Focus · Active · Disabled**
These are built as ComponentSet variants (not variable modes) so Figma prototype
wiring works: ON_HOVER → Hover, ON_CLICK → Active, keyboard → Focus.

Build these states? (yes / no / custom list)
```

If approved, for each state create a separate COMPONENT with `State=<name>` in its name. Then combine and wire:

```javascript
// Pre-position before combining
const variants = [defaultComp, hoverComp, focusComp, activeComp, disabledComp];
variants.forEach((v, i) => { v.x = i * 400; v.y = -30000; pg.appendChild(v); });

const set = figma.combineAsVariants(variants, pg);
set.name = 'ComponentName 1.0.0'; // always include X.Y.Z — new = 1.0.0, update = bump per rule
set.layoutMode = 'HORIZONTAL'; set.layoutWrap = 'WRAP';
set.primaryAxisSizingMode = 'AUTO'; set.counterAxisSizingMode = 'AUTO';
set.itemSpacing = 8; set.paddingTop = 20; set.paddingBottom = 20;
set.paddingLeft = 20; set.paddingRight = 20;
try { set.counterAxisSpacing = 8; } catch(e) {}

// Wire interactions after combining
async function rxAdd(set, list) {
  for (const { from, to, trigger } of list) {
    const src = set.children.find(n => n.name.includes(from));
    const dst = set.children.find(n => n.name.includes(to));
    if (!src || !dst) continue;
    await src.setReactionsAsync([...(src.reactions || []), {
      actions: [{ type: 'NODE', destinationId: dst.id, navigation: 'CHANGE_TO',
                  transition: null, preserveScrollPosition: false }],
      trigger: { type: trigger }
    }]);
  }
}

await rxAdd(set, [
  { from: 'Default', to: 'Hover',   trigger: 'ON_HOVER' },
  // Note: MOUSE_LEAVE is NOT a valid Figma trigger — ON_HOVER auto-returns when mouse leaves.
  // Do NOT add a MOUSE_LEAVE reaction. Figma handles the return automatically.
  { from: 'Default', to: 'Active',  trigger: 'ON_PRESS' },
  { from: 'Default', to: 'Focus',   trigger: 'ON_CLICK' },
]);
```

Focus ring pattern (use for Focus state):
```javascript
const FOCUS_RING = [
  { type:'DROP_SHADOW', color:{r:0,g:0.42,b:0.88,a:1}, offset:{x:0,y:0}, radius:0, spread:4, visible:true, blendMode:'NORMAL' },
  { type:'DROP_SHADOW', color:{r:1,g:1,b:1,a:1},       offset:{x:0,y:0}, radius:0, spread:2, visible:true, blendMode:'NORMAL' }
];
```

---

## Step 9 — Additional variants

After states, propose other variant dimensions. Before deciding how to implement each dimension, apply the decision tree below.

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

**Critical rule: Type dimensions almost always use variable modes, not variants.**

A "type" dimension (Primary/Secondary/Ghost/Danger, Success/Warning/Error, etc.) changes only colors — background fill, text color, stroke color. The layout is identical across all types. This is the exact use case for variable collection modes. Building types as ComponentSet variants inflates variant counts unnecessarily (5 states × 4 types = 20 variants vs. 5 variants with 4 modes).

| Dimension | Correct approach | Reason |
|---|---|---|
| State (Default/Hover/Focus/Active/Disabled) | ComponentSet variants | Prototype wiring requires distinct nodes |
| Type (Primary/Secondary/Ghost/Danger) | Variable collection modes | Only colors change — layout identical |
| Size (SM/MD/LG) | Variable collection modes | Only spacing/font values change |
| Theme (Light/Dark) | Variable collection modes | Only colors change |
| Layout (Horizontal/Vertical) | ComponentSet variants | Child order/direction changes |
| Show/hide an element | Boolean component property | Presence/absence, no other change |

### Variable mode pattern for Type

```javascript
// 1. Create a variable collection for the type dimension
const colls = await figma.variables.getLocalVariableCollectionsAsync();
let typeColl = colls.find(c => c.name === 'Button · Type');
if (!typeColl) {
  typeColl = figma.variables.createVariableCollection('Button · Type');
  typeColl.renameMode(typeColl.modes[0].modeId, 'Primary');
}
const primaryMode = typeColl.modes[0].modeId;
const secondaryMode = typeColl.addMode('Secondary');
const ghostMode     = typeColl.addMode('Ghost');
const dangerMode    = typeColl.addMode('Danger');

// 2. Create one variable per property that changes across types
const bgVar = figma.variables.createVariable('button/bg', typeColl, 'COLOR');
bgVar.setValueForMode(primaryMode, { r: 0.071, g: 0.071, b: 0.078, a: 1 }); // ink-black
bgVar.setValueForMode(secondaryMode, { r: 0.961, g: 0.941, b: 0.922, a: 1 }); // paper
bgVar.setValueForMode(ghostMode,     { r: 0, g: 0, b: 0, a: 0 });             // transparent
bgVar.setValueForMode(dangerMode,    { r: 0.863, g: 0.133, b: 0.0, a: 1 });   // overprint-red

// (repeat for fgVar, strokeVar, hasBorderVar, etc.)

// 3. Bind type variables to each STATE variant — identical binding in all 5
for (const variant of set.children) {
  const fills = [{ type: 'SOLID', color: { r: 0.071, g: 0.071, b: 0.078 } }];
  const f = figma.variables.setBoundVariableForPaint(fills[0], 'color', bgVar);
  variant.fills = [f];
  // bind text, stroke, etc. similarly
}

// 4. When instantiating, callers set the mode to choose the type:
// instance.setExplicitVariableModeForCollection(typeColl, secondaryMode);
```

**On instances, set the type mode** (not a variant property):
```javascript
// In consuming code or when placing the component:
const inst = buttonVariant.createInstance();
inst.setExplicitVariableModeForCollection(typeColl, ghostMode); // → Ghost type
```

### Boolean property pattern (show/hide)

```javascript
// On the COMPONENT (not COMPONENT_SET):
comp.addComponentProperty('showFooter', 'BOOLEAN', true);
const propKey = Object.keys(comp.componentPropertyDefinitions).find(k => k.startsWith('showFooter'));
// Bind to the frame that should show/hide:
const footerFrame = comp.findOne(n => n.name === 'Footer');
if (propKey && footerFrame) footerFrame.componentPropertyReferences = { visible: propKey };
```

### Examples (correct implementations)

- Modal footer (show/hide) → `showFooter: BOOLEAN` ✓
- Card image slot (show/hide) → `showImage: BOOLEAN` ✓
- Button leading icon (show/hide) → `showIcon: BOOLEAN` ✓
- Button Primary vs Ghost vs Danger (colors only) → **variable mode** ✓ (NOT a variant)
- Button Size SM vs LG (spacing/font only) → **variable mode** ✓ (NOT a variant)
- Modal SM vs MD vs LG (different fixed width) → variant ✓ (layout/size changes)
- Card Horizontal vs Vertical (different child order) → variant ✓ (layout changes)

States always use ComponentSet (Step 8). Additional dimensions follow the decision tree above.

Ask: "Which additional variants would you like? (numbers / all / none)"

---

## Step 10 — Component description

Generate a description and apply via `figma_execute`:
```javascript
const comp = figma.currentPage.findOne(n =>
  n.name === 'YourComponent' && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'));
if (comp) comp.description = `<description>`;
```

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

Show to user: "Does this description look good? (yes / edit / skip)"

---

## Step 11 — Wrap up

Show summary and suggest next step:

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
