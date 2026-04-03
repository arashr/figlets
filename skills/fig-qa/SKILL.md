---
name: fig-qa
version: 1.0.0
description: Audit a Figma component or page for token/variable compliance. Every spacing, color, border, and typography value must be bound to a variable. Accepts an optional Figma URL or uses the active selection. Ends by suggesting /fig-document when clean.
---

# fig-qa

You are a Figma design QA agent. Audit a Figma design for token/variable compliance — every spacing, color, border, and typography value must be bound to a variable. Raw hardcoded values are violations.

---

## Step 1 — Establish context

If $ARGUMENTS contains a figma.com URL:
- Parse fileKey and nodeId. Use `mcp__Figma__get_design_context` as primary source.

If $ARGUMENTS is empty:
- Call `mcp__Figma__get_design_context` (no params) to check current selection.
- If something is selected → scope audit to that selection only.
- If nothing selected → audit entire current page.

---

## Step 2 — Load variables

Call `mcp__Figma__get_variable_defs` to retrieve all variables.

If none returned: ask for a library file URL or file key and retry.

---

## Step 3 — Traverse and inspect nodes

Use `use_figma` with the audit script. Skip INSTANCE nodes — master components carry the bindings.

**Correct boundVariables field names:**
- Fills: `node.boundVariables?.fills?.[i]` (NOT `.fills?.[i]?.color`)
- Strokes: `node.boundVariables?.strokes?.[i]` (NOT `.strokes?.[i]?.color`)
- Stroke weight on TEXT: `node.boundVariables?.strokeWeight`
- Stroke weight on non-TEXT: `node.boundVariables?.strokeTopWeight`
- Corner radius: `node.boundVariables?.topLeftRadius` (NOT `cornerRadius`)
- Spacing/font size: `node.boundVariables?.[prop]`

```javascript
function auditNode(node) {
  if (node.type === 'INSTANCE') return [];
  const violations = [];
  const name = node.name;

  // Fills
  if (node.fills && Array.isArray(node.fills)) {
    node.fills.forEach((fill, i) => {
      if (fill.type === 'SOLID' && !node.boundVariables?.fills?.[i]) {
        const r = Math.round(fill.color.r * 255);
        const g = Math.round(fill.color.g * 255);
        const b = Math.round(fill.color.b * 255);
        violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type, fillIndex: i,
          property: 'Fill color', rawValue: `rgb(${r},${g},${b})`, type: 'color' });
      }
    });
  }

  // Strokes
  if (node.strokes && Array.isArray(node.strokes)) {
    node.strokes.forEach((s, i) => {
      if (s.type === 'SOLID' && !node.boundVariables?.strokes?.[i]) {
        const r = Math.round(s.color.r * 255);
        const g = Math.round(s.color.g * 255);
        const b = Math.round(s.color.b * 255);
        violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type, strokeIndex: i,
          property: 'Stroke color', rawValue: `rgb(${r},${g},${b})`, type: 'color' });
      }
    });
  }

  // Stroke weight — only flag if node actually has strokes
  if (node.strokes?.length > 0 && node.strokeWeight && node.strokeWeight !== 0) {
    const swBound = node.type === 'TEXT'
      ? node.boundVariables?.strokeWeight
      : node.boundVariables?.strokeTopWeight;
    if (!swBound) violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
      property: 'Stroke weight', rawValue: `${node.strokeWeight}px`, type: 'border' });
  }

  // Corner radius
  if (node.type !== 'TEXT' && typeof node.cornerRadius === 'number' && node.cornerRadius !== 0) {
    if (!node.boundVariables?.topLeftRadius) {
      violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
        property: 'Corner radius', rawValue: `${node.cornerRadius}px`, type: 'border' });
    }
  }

  // Auto-layout spacing
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    ['paddingTop','paddingBottom','paddingLeft','paddingRight','itemSpacing','counterAxisSpacing'].forEach(prop => {
      if (node[prop] && node[prop] !== 0 && !node.boundVariables?.[prop]) {
        violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
          property: prop, rawValue: `${node[prop]}px`, type: 'spacing' });
      }
    });
  }

  // Font size
  if (node.type === 'TEXT' && node.fontSize !== figma.mixed && !node.boundVariables?.fontSize) {
    violations.push({ nodeId: node.id, nodeName: name, nodeType: node.type,
      property: 'Font size', rawValue: `${node.fontSize}px`, type: 'typography' });
  }

  if ('children' in node) node.children.forEach(c => violations.push(...auditNode(c)));
  return violations;
}

const scope = figma.currentPage.selection.length > 0
  ? figma.currentPage.selection
  : figma.currentPage.children;

const allViolations = [];
scope.forEach(node => allViolations.push(...auditNode(node)));
return JSON.stringify(allViolations);
```

**Note on false positives:** `strokeWeight = 1` on nodes with `strokes = []` (empty array) is Figma's default — not a real violation. The audit script above already guards this with `node.strokes?.length > 0`.

---

## Step 4 — Match violations to nearest variable

Resolve COLOR variables to hex via first-mode value. Build hex → variable map.

- **Color:** Convert rgb to hex. Exact match first. Then nearest by Euclidean RGB distance per channel avg. If distance > 30 → suggest "No close variable — consider creating one."
- **Spacing / border:** Nearest FLOAT variable. Prefer exact. Note if approximated.
- **Typography:** Nearest FLOAT variable.

---

## Step 5 — Output the report

### Audit scope
File, page, selection or full page.

### Variable library
Variables found and source.

### Violation summary
e.g. "Found 23 violations: 8 color, 7 spacing, 5 border, 3 typography."

### Violations table

| # | Node | Property | Raw Value | Type | Suggested Variable |
|---|---|---|---|---|---|

Sort: color → spacing → border → typography, then alphabetically by node name.

If zero violations: "No violations found. All inspected properties are bound to variables." Skip to Step 7.

---

## Step 6 — Ask the user what to do

```
What would you like to do?
1. Fix all violations automatically
2. Review and fix one by one
3. Skip fixing (report only)
```

**Option 1 — Fix all:**
Run fix script for each violation. Collect `fixed[]` and `skipped[]`.

**Option 2 — One by one:**
```
[#N] Node: <name> | Property: <prop> | Value: <raw> | Suggested: <variable>
Fix this? (y / n / skip all)
```
`y` → fix. `n` → add to known-issues. `skip all` → remaining to skipped.

**Option 3 — Skip:**
Add all to known-issues. Do not modify Figma.

### Fix script pattern

```javascript
const allVars = await figma.variables.getLocalVariablesAsync();
const v = allVars.find(x => x.name === suggestedVarName);
if (!v) return 'VAR_NOT_FOUND';
const node = await figma.getNodeByIdAsync(nodeId);
if (!node) return 'NODE_NOT_FOUND';

if (property === 'Fill color') {
  const fills = JSON.parse(JSON.stringify(node.fills));
  fills[fillIndex] = figma.variables.setBoundVariableForPaint(fills[fillIndex], 'color', v);
  node.fills = fills;
}
if (property === 'Stroke color') {
  const strokes = JSON.parse(JSON.stringify(node.strokes));
  strokes[strokeIndex] = figma.variables.setBoundVariableForPaint(strokes[strokeIndex], 'color', v);
  node.strokes = strokes;
}
if (property === 'Stroke weight') {
  if (node.type === 'TEXT') { node.setBoundVariable('strokeWeight', v); }
  else { ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight']
    .forEach(p => node.setBoundVariable(p, v)); }
}
if (property === 'Corner radius') {
  ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']
    .forEach(p => node.setBoundVariable(p, v));
}
if (['paddingTop','paddingBottom','paddingLeft','paddingRight','itemSpacing','counterAxisSpacing'].includes(property)) {
  node.setBoundVariable(property, v);
}
if (property === 'Font size') { node.setBoundVariable('fontSize', v); }
return 'OK';
```

---

## Step 7 — Write changelog.md

After fixing (or if zero violations), append to `changelog.md` in the working directory.

```markdown
## [YYYY-MM-DD HH:MM] fig-qa — <file> · <page> · <component>

**Scope:** <selection or full page>
**Fixed:** <N> violations
**Skipped:** <N>

| Node | Property | Raw Value | Bound To |
|---|---|---|---|
| ... | ... | ... | ... |
```

Prepend the new entry below a `---` separator (newest entry at top).

---

## Step 8 — Write known-issues.md

If unfixed violations exist, append to `known-issues.md`.

```markdown
## [YYYY-MM-DD HH:MM] fig-qa — <file> · <page> · <component>

| Node | Property | Raw Value | Type | Reason |
|---|---|---|---|---|
| ... | ... | ... | ... | No variable found / Skipped by user |
```

If all fixed with no known issues, do not modify known-issues.md.

---

## Step 9 — Suggest next step

If all violations fixed (or zero violations found):
```
QA complete — no outstanding violations.

Ready for documentation? Run /fig-document to generate the component spec sheet,
anatomy diagram, and MCP-ready handover file.
```

If violations remain unfixed:
```
QA complete — <N> violations remain in known-issues.md.

You can proceed to /fig-document now, or resolve known issues first.
```
