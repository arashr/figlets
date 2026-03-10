# figlets

> A Claude Code plugin for building production-quality Figma design system components.

Three skills, one workflow — **build → audit → document** Figma components with full token binding, state variants, prototype wiring, and a machine-readable spec handover.

---

## Skills

| Skill | Invoke | What it does |
|---|---|---|
| **fig-create** | `/fig-create` | Builds a component: auto-layout, all values token-bound, state variants wired for prototype, accessibility check |
| **fig-qa** | `/fig-qa` | Audits every value — flags anything not bound to a variable; auto-fix or review one-by-one |
| **fig-document** | `/fig-document` | Generates a visual spec sheet in Figma + `component-specs/[Name].md` for LLM code handover |

---

## Prerequisites

- [Claude Code](https://claude.ai/code)
- Figma Desktop with the **Desktop Bridge** plugin running
  *(Right-click canvas → Plugins → Development → Open Console)*
- [`figma-console` MCP server](https://github.com/southleft/figma-console-mcp) connected to Claude Code
- A Figma file with design token variables defined

---

## Installation

```bash
claude plugin marketplace add github:arashr/figlets
claude plugin install figlets
```

---

## Workflow

```
/fig-create [url | frame | screenshot | description]
   ↓  token gap audit → build → self-audit → a11y check

/fig-qa
   ↓  full node traverse → flag unbound values → auto-fix or one-by-one

/fig-document
   ↓  spec sheet in Figma + component-specs/[Name].md handover file
```

---

## fig-create

Builds a component from a Figma URL, selected frame, screenshot, or text description.

- Loads all design token variables and maps them to hex/value lookups
- Audits the source design for token gaps before building — proposes nearest token for each unmatched value
- Detects repeating sub-patterns and offers to reuse existing components as instances
- Uses `ComponentSet` variants for interaction states (Default / Hover / Focus / Active / Disabled) so prototype wiring works
- Uses variable collection modes for type dimensions (Primary / Secondary / Ghost — colors only, no duplicate layouts)
- Uses boolean component properties for show/hide elements
- Wires `ON_HOVER → Hover`, `ON_PRESS → Active`, `ON_CLICK → Focus` reactions
- Runs a post-build self-audit and fixes remaining violations before screenshot
- Checks WCAG AA contrast ratios and touch target sizes

```
/fig-create                         # uses current Figma selection
/fig-create Button                  # text description
/fig-create https://figma.com/...   # Figma URL
```

---

## fig-qa

Traverses every node in the selection (or full page if nothing selected), checking all fill colors, stroke colors, stroke weights, corner radii, padding, gaps, and font sizes for variable bindings. Skips INSTANCE nodes — master components carry the bindings.

- Matches each violation to the nearest existing variable
- Offers: fix all / review one-by-one / report only
- Writes `changelog.md` and `known-issues.md` in the project directory

```
/fig-qa                             # audits current selection or full page
/fig-qa https://figma.com/...       # audits specific node
```

---

## fig-document

Generates a complete spec sheet and a machine-readable handover file.

**Figma spec sheet** (`[ComponentName] · Spec` frame, Documentation section):
- Live preview of the default variant
- Variant showcase (all variants side by side)
- Properties table (TYPE / DEFAULT VALUE)
- Token bindings table (NODE / PROPERTY / TOKEN / RESOLVED VALUE)
- Spacing & sizing annotations
- Anatomy diagram — numbered badges positioned from real bounding boxes
- Do / Don't usage guidelines

**Local file** (`component-specs/[ComponentName].md`):
- Variants, properties, token bindings, accessibility results, sizing, anatomy — all in one LLM-readable file
- Spec-oriented, no framework code — any LLM can implement the component correctly in any stack

**Figma description** updated with a compact `[SPEC]` block for MCP tool context.

```
/fig-document                       # uses current Figma selection
/fig-document Button                # by component name
```

---

## Update check (optional)

figlets checks for updates once per session and tells Claude when a newer version is available. To enable it, add the following to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/check-update.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

When an update is available, Claude will mention it at the start of your next session:
> *"figlets update available: v1.0.0 → v1.1.0. Run: `claude plugin update figlets`"*

The check only runs once per 24 hours and exits instantly when no update is needed.

---

## Publishing a new version

```bash
./scripts/release.sh [patch|minor|major]
```

This will:
1. Show all commits since the last release
2. Show which SKILL.md files changed
3. Ask: `Publish v1.1.0? [y/N]`
4. If confirmed: bump `plugin.json`, commit, tag, push

GitHub Actions creates the GitHub Release automatically when the tag lands.

---

## License

MIT
