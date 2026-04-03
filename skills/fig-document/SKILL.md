---
name: fig-document
version: 1.0.0
description: Generate a complete visual spec sheet and MCP-ready handover file for a Figma component. Creates anatomy diagram with real bounding box positions, variant showcase, token bindings table, and writes a local component-specs/[Name].md file for LLM coding context. Run after /fig-qa is clean.
---

# fig-document

You are a Figma documentation engineer. Generate a complete spec sheet inside Figma and a machine-readable handover file that any LLM can use to implement the component correctly in code.

---

## Step 1 — Find the component

If $ARGUMENTS contains a component name or Figma URL: locate it.

Otherwise call `mcp__Figma__get_design_context` (no params). Use the selected COMPONENT or COMPONENT_SET if present. If nothing is selected, ask: "Which component should I document? (name or select it in Figma)"

Read its structure:
```javascript
const comp = figma.currentPage.findOne(n =>
  (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === 'ComponentName');
return {
  id: comp.id,
  type: comp.type,
  width: comp.width,
  height: comp.height,
  variantCount: comp.type === 'COMPONENT_SET' ? comp.children.length : 1,
  variants: comp.type === 'COMPONENT_SET' ? comp.children.map(c => c.name) : [comp.name],
  componentPropertyDefinitions: comp.componentPropertyDefinitions,
  description: comp.description
};
```

---

## Step 2 — Read bounding boxes for anatomy

Use `use_figma` to read the **absolute bounding box** of each named child node for precise annotation badge positions:

```javascript
const comp = figma.currentPage.findOne(n =>
  (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.name === 'ComponentName');

// For ComponentSet, use the first (default) variant
const target = comp.type === 'COMPONENT_SET'
  ? comp.children.find(c => c.name.includes('Default') || c.name.includes('Full')) || comp.children[0]
  : comp;

const compBounds = target.absoluteBoundingBox;

// Collect all named, non-instance leaf areas
const elements = [];
function collectElements(node, depth = 0) {
  if (!node.absoluteBoundingBox) return;
  const nb = node.absoluteBoundingBox;
  elements.push({
    name: node.name,
    type: node.type,
    depth,
    x: Math.round(nb.x - compBounds.x),
    y: Math.round(nb.y - compBounds.y),
    w: Math.round(nb.width),
    h: Math.round(nb.height),
  });
  if ('children' in node && node.type !== 'INSTANCE') {
    node.children.forEach(c => collectElements(c, depth + 1));
  }
}
collectElements(target);
return JSON.stringify({ compW: target.width, compH: target.height, compBounds, elements });
```

From the returned elements, select meaningful ones (skip anonymous wrapper frames; keep named elements representing distinct UI areas). Use their `x`, `y`, `w`, `h` to position annotation badges.

---

## Step 3 — Collect token bindings

Read which design tokens are bound to which properties on the default variant:

```javascript
const target = /* default variant from Step 2 */;

function collectBindings(node, bindings = []) {
  if (node.type === 'INSTANCE') return bindings;

  async function getVarName(id) {
    const v = await figma.variables.getVariableByIdAsync(id);
    return v ? v.name : id;
  }

  const bv = node.boundVariables || {};
  const checks = [
    ['fills',    'Fill'],
    ['strokes',  'Stroke'],
    ['paddingTop', 'paddingTop'], ['paddingBottom','paddingBottom'],
    ['paddingLeft','paddingLeft'], ['paddingRight','paddingRight'],
    ['itemSpacing','itemSpacing'], ['counterAxisSpacing','counterAxisSpacing'],
    ['fontSize','fontSize'], ['topLeftRadius','cornerRadius'],
    ['strokeTopWeight','strokeWeight'],
  ];

  for (const [key, label] of checks) {
    if (bv[key]) {
      const entry = Array.isArray(bv[key]) ? bv[key][0] : bv[key];
      if (entry?.id) {
        bindings.push({ node: node.name, property: label, varId: entry.id });
      }
    }
  }

  if ('children' in node) node.children.forEach(c => collectBindings(c, bindings));
  return bindings;
}

const raw = collectBindings(target);
// Resolve variable names
const resolved = [];
for (const b of raw) {
  const v = await figma.variables.getVariableByIdAsync(b.varId);
  resolved.push({ node: b.node, property: b.property, token: v ? v.name : b.varId });
}
return JSON.stringify(resolved);
```

---

## Step 4 — Build the spec sheet in Figma

Use `use_figma`. Pre-flight rules: `layoutSizingHorizontal = 'FILL'` always AFTER `parent.appendChild()`, `textAutoResize = 'HEIGHT'` always AFTER append, fill colors `{ r, g, b }` only.

### Find or create Documentation section

```javascript
let docSection = figma.currentPage.findOne(n => n.type === 'SECTION' && n.name === 'Documentation');
if (!docSection) {
  docSection = figma.createSection();
  docSection.name = 'Documentation';
  figma.currentPage.appendChild(docSection);
}
const oldSpec = figma.currentPage.findOne(n => n.name === `${compName} · Spec`);
if (oldSpec) oldSpec.remove();
```

### Doc frame structure

```javascript
const doc = figma.createFrame();
doc.name = `${compName} · Spec`;
doc.layoutMode = 'VERTICAL';
doc.primaryAxisSizingMode = 'AUTO';
doc.counterAxisSizingMode = 'FIXED';
doc.resize(1400, 100);
doc.paddingTop = 64; doc.paddingBottom = 64;
doc.paddingLeft = 60; doc.paddingRight = 60; // 1280px inner
doc.itemSpacing = 56;
doc.fills = [{ type: 'SOLID', color: { r: 0.961, g: 0.941, b: 0.922 } }]; // paper
docSection.appendChild(doc);
```

### Section label helper

```javascript
function makeLabel(parent, text) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Semi Bold' };
  t.characters = text; t.fontSize = 11;
  t.letterSpacing = { value: 2, unit: 'PIXELS' };
  t.fills = [{ type: 'SOLID', color: { r: 0.439, g: 0.439, b: 0.569 } }];
  parent.appendChild(t);
  return t;
}
```

### Section A — Header

Title (40px Bold, ink-black) + subtitle (16px Regular, ink-subtle, FILL width).

### Section B — Preview

Bordered frame containing a live instance of the default variant.

```javascript
const previewFrame = figma.createFrame();
previewFrame.layoutMode = 'HORIZONTAL';
previewFrame.primaryAxisAlignItems = 'CENTER'; previewFrame.counterAxisAlignItems = 'CENTER';
previewFrame.paddingTop = 40; previewFrame.paddingBottom = 40;
previewFrame.paddingLeft = 40; previewFrame.paddingRight = 40;
previewFrame.fills = [{ type: 'SOLID', color: { r: 0.937, g: 0.918, b: 0.898 } }];
previewFrame.cornerRadius = 8;
previewFrame.strokes = [{ type: 'SOLID', color: { r: 0.851, g: 0.831, b: 0.804 } }];
previewFrame.strokeWeight = 1;
doc.appendChild(previewFrame);
previewFrame.layoutSizingHorizontal = 'FILL';

const defaultVariant = compSet.children.find(c => c.name.includes('Default') || c.name.includes('Full')) || compSet.children[0];
const inst = defaultVariant.createInstance();
previewFrame.appendChild(inst);
inst.layoutSizingHorizontal = 'FILL';
```

### Section C — Variant showcase

All variants side by side. If > 4 variants, show first 4 and note "… and N more".

```javascript
const showcaseFrame = figma.createFrame();
showcaseFrame.layoutMode = 'HORIZONTAL';
showcaseFrame.primaryAxisSizingMode = 'AUTO'; showcaseFrame.counterAxisSizingMode = 'AUTO';
showcaseFrame.primaryAxisAlignItems = 'CENTER';
showcaseFrame.itemSpacing = 16;
showcaseFrame.paddingTop = 24; showcaseFrame.paddingBottom = 24;
showcaseFrame.paddingLeft = 24; showcaseFrame.paddingRight = 24;
showcaseFrame.fills = [{ type: 'SOLID', color: { r: 0.937, g: 0.918, b: 0.898 } }];
showcaseFrame.cornerRadius = 8;
doc.appendChild(showcaseFrame);

const displayVariants = compSet.children.slice(0, 6);
for (const variant of displayVariants) {
  const vFrame = figma.createFrame();
  vFrame.layoutMode = 'VERTICAL'; vFrame.primaryAxisSizingMode = 'AUTO'; vFrame.counterAxisSizingMode = 'AUTO';
  vFrame.primaryAxisAlignItems = 'CENTER'; vFrame.itemSpacing = 8; vFrame.fills = [];
  showcaseFrame.appendChild(vFrame);

  const vInst = variant.createInstance();
  vFrame.appendChild(vInst);

  const vLabel = figma.createText();
  vLabel.fontName = { family: 'Inter', style: 'Regular' };
  vLabel.characters = variant.name.replace(/,\s*/g, '\n');
  vLabel.fontSize = 10; vLabel.textAlignHorizontal = 'CENTER';
  vLabel.fills = [{ type: 'SOLID', color: { r: 0.439, g: 0.439, b: 0.569 } }];
  vFrame.appendChild(vLabel);
}
```

### Section D — Properties table

Striped rows table: PROPERTY | TYPE | DEFAULT VALUE. Dark header row (ink-black-soft bg, ink-subtle text). Alternating white/paper-tinted rows. One row per component property from `comp.componentPropertyDefinitions`.

### Section E — Token bindings table

```javascript
// Striped table: NODE | PROPERTY | TOKEN
// Data from Step 3 resolved bindings
// Group by node name for readability
```

Columns: **Node** · **Property** · **Token** · **Resolved Value**

Resolved value: look up the token's first-mode value (hex for colors, px for floats).

### Section F — Spacing & sizing

Plain text annotations listing key measurements and their tokens. One line per measurement: `Padding: 48px all sides → 2xl token`

### Section G — Anatomy

Wrapper frame at the component's natural width and height, `layoutMode = 'HORIZONTAL'` (to allow ABSOLUTE children), `clipsContent = false`.

Place a live instance inside at natural size (ABSOLUTE, x=0, y=0).

For each named element from Step 2, place an annotation badge:

```javascript
// Badge positioned using real bounding box data
elements.forEach(({ name, x, y, w, h }, idx) => {
  const n = idx + 1;
  const SIZE = 22;

  // Place badge at element's top-left corner, offset slightly outside
  // For left-side elements (x < 100): badge goes left of element
  // For top elements (y < 20): badge goes above
  // Otherwise: badge at element center
  const bx = x < 100 ? x - SIZE - 6 : Math.round(x + w/2 - SIZE/2);
  const by = y < 20  ? -SIZE - 4     : Math.round(y + h/2 - SIZE/2);

  const badge = figma.createEllipse();
  badge.name = `Badge ${n}`;
  badge.resize(SIZE, SIZE);
  badge.fills = [{ type: 'SOLID', color: { r: 0.863, g: 0.133, b: 0.000 } }]; // overprint-red
  wrapper.appendChild(badge);
  badge.layoutPositioning = 'ABSOLUTE';
  badge.x = bx; badge.y = by;

  const numT = figma.createText();
  numT.fontName = { family: 'Inter', style: 'Bold' };
  numT.characters = String(n);
  numT.fontSize = n >= 10 ? 9 : 10;
  numT.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  numT.textAlignHorizontal = 'CENTER'; numT.textAlignVertical = 'CENTER';
  numT.resize(SIZE, SIZE);
  wrapper.appendChild(numT);
  numT.layoutPositioning = 'ABSOLUTE';
  numT.x = bx; numT.y = by;
});
```

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

Prepend a compact machine-readable block to the component's Figma description:

```javascript
const specBlock = `[SPEC]
component: ${compName}
variants: ${variantDimensions}
properties: ${propList}
tokens: ${tokenSummary}
a11y: ${a11ySummary}
spec-file: component-specs/${compName}.md
[/SPEC]

`;

const comp = figma.currentPage.findOne(n =>
  n.name === compName && (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'));
if (comp) {
  const existing = comp.description || '';
  // Replace existing [SPEC] block if present, otherwise prepend
  const cleaned = existing.replace(/\[SPEC\][\s\S]*?\[\/SPEC\]\n*/g, '');
  comp.description = specBlock + cleaned;
}
```

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
