---
name: fig-qa
version: 1.0.0
description: Audit a Figma component or page for token/variable compliance. Every spacing, color, border, and typography value must be bound to a variable. Accepts an optional Figma URL or uses the active selection. Ends by suggesting /fig-document when clean.
---

# fig-qa

You are a Figma design QA agent. Audit a Figma design for token/variable compliance — every spacing, color, border, and typography value must be bound to a variable. Raw hardcoded values are violations.

---

## Step 1 — Establish context

If $ARGUMENTS contains a figma.com URL: parse fileKey and nodeId, use `mcp__Figma__get_design_context` as primary source.

If $ARGUMENTS is empty: call `mcp__Figma__get_design_context` (no params). If something is selected → scope audit to that selection. If nothing selected → audit entire current page.

---

## Step 2 — Load variables

Call `mcp__Figma__get_variable_defs`. If none returned: ask for a library file URL or file key and retry.

---

## Step 3 — Traverse and inspect nodes

Read `~/.claude/skills/fig-qa/scripts/audit-traverse.js` then run via `use_figma`. Skip INSTANCE nodes — master components carry the bindings.

**Correct boundVariables field names:**
- Fills: `node.boundVariables?.fills?.[i]` (NOT `.fills?.[i]?.color`)
- Strokes: `node.boundVariables?.strokes?.[i]` (NOT `.strokes?.[i]?.color`)
- Stroke weight on TEXT: `node.boundVariables?.strokeWeight`
- Stroke weight on non-TEXT: `node.boundVariables?.strokeTopWeight`
- Corner radius: `node.boundVariables?.topLeftRadius` (NOT `cornerRadius`)
- Spacing/font size: `node.boundVariables?.[prop]`

**Note on false positives:** `strokeWeight = 1` on nodes with `strokes = []` is Figma's default — not a violation. The script already guards this with `node.strokes?.length > 0`.

---

## Step 4 — Match violations to nearest variable

Resolve COLOR variables to hex via first-mode value. Build hex → variable map.

- **Color:** Convert rgb to hex. Exact match first, then nearest by Euclidean RGB distance avg. Distance > 30 → suggest "No close variable — consider creating one."
- **Spacing / border / typography:** Nearest FLOAT variable. Prefer exact. Note if approximated.

---

## Step 5 — Output the report

**Audit scope:** file, page, selection or full page. **Variable library:** variables found and source. **Violation summary:** e.g. "Found 23 violations: 8 color, 7 spacing, 5 border, 3 typography."

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

**Option 1 — Fix all:** Run fix script for each violation. Collect `fixed[]` and `skipped[]`.

**Option 2 — One by one:**
```
[#N] Node: <name> | Property: <prop> | Value: <raw> | Suggested: <variable>
Fix this? (y / n / skip all)
```
`y` → fix. `n` → add to known-issues. `skip all` → remaining to skipped.

**Option 3 — Skip:** Add all to known-issues. Do not modify Figma.

### Fix script pattern

Read `~/.claude/skills/fig-qa/scripts/fix-violation.js`, substitute `nodeId`, `property`, `fillIndex`, `strokeIndex`, and `suggestedVarName` from the violation record, then run via `use_figma`.

---

## Step 7 — Write changelog.md

After fixing (or if zero violations), append to `changelog.md` in the working directory:

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

If unfixed violations exist, append to `known-issues.md`:

```markdown
## [YYYY-MM-DD HH:MM] fig-qa — <file> · <page> · <component>

| Node | Property | Raw Value | Type | Reason |
|---|---|---|---|---|
| ... | ... | ... | ... | No variable found / Skipped by user |
```

If all fixed with no known issues, do not modify known-issues.md.

---

## Step 9 — Suggest next step

If all violations fixed (or zero found):
```
QA complete — no outstanding violations.

Ready for documentation? Run /fig-document to generate the component spec sheet,
anatomy diagram, and MCP-ready handover file.
```

If violations remain:
```
QA complete — <N> violations remain in known-issues.md.

You can proceed to /fig-document now, or resolve known issues first.
```
