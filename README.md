# figlets

> A Claude Code plugin for building production-quality Figma design systems and components.

Four skills covering the full design system lifecycle — from bootstrapping a variable architecture to building, auditing, and documenting components.

---

## Skills

| Skill | Invoke | What it does |
|---|---|---|
| **fig-setup** | `/fig-setup` | Bootstraps a complete variable architecture — color ramps with contrast tables, semantic light/dark tokens, scrim/state tokens, elevation Effect Styles, responsive typography, and spacing. Standalone — run it independently whenever starting a new design system. |
| **fig-create** | `/fig-create` | Builds a component: auto-layout, all values token-bound, state variants wired for prototype, accessibility check |
| **fig-qa** | `/fig-qa` | Audits every value — flags anything not bound to a variable; auto-fix or review one-by-one |
| **fig-document** | `/fig-document` | Generates a visual spec sheet in Figma + `component-specs/[Name].md` for LLM code handover |

---

## Prerequisites & Setup

figlets uses Figma's native MCP — no bridge plugin or local server required. The MCP gives Claude direct read and write access to your Figma files via the Plugin API.

### 1. Get a Figma Personal Access Token

In Figma: **Account → Settings → Personal access tokens → Generate new token**. Copy the token (starts with `figd_`) — it's shown only once.

### 2. Connect the Figma MCP to Claude Code

Follow Figma's official MCP setup guide to add the Figma MCP to Claude Code. You will need your personal access token from step 1.

Once connected, you should see `mcp__Figma__` tools available in your Claude Code session.

### 3. Test the connection

Copy the URL of a Figma file and ask Claude:
> "What's on the first page of this Figma file? [paste URL]"

Claude should describe the file contents. If it does, figlets is ready to use.

---

## Installation

### One command (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/arashr/figlets/main/install.sh | bash
```

Downloads the three SKILL.md files into `~/.claude/skills/`. Works on macOS and Linux. No git or npm required.

### Via Claude plugin marketplace

```bash
claude plugin marketplace add arashr/figlets
claude plugin install figlets
```

### Manual

Copy each `skills/<name>/SKILL.md` to `~/.claude/skills/<name>/SKILL.md`

---

## Workflow

Each skill is standalone — use them independently or chain them:

```
/fig-setup   (optional — if starting a new design system from scratch)
   ↓  intake → 4 variable collections built in Figma → optional token showcase

/fig-create [url | frame | screenshot | description]
   ↓  token gap audit → build → self-audit → a11y check

/fig-qa
   ↓  full node traverse → flag unbound values → auto-fix or one-by-one

/fig-document
   ↓  spec sheet in Figma + component-specs/[Name].md handover file
```

---

## fig-setup

Bootstraps a complete Figma variable architecture for a new design system. Walks through project intake (platform, brand colors, scale choices), then builds 5 variable collections one at a time — previewing each before writing to Figma.

- **Collection 1 — Primitives**: color ramps with WCAG/APCA contrast annotations, scrim primitives, shadow primitives, full type scale, and spacing scale (8px and 4px grids, including 44px WCAG touch target). Hidden from publishing.
- **Collection 2 — Color Semantics**: Light/Dark mode aliases — every bg token is defined with its paired text token and inline contrast ratio. No pair below 4.5:1 is built without approval. Role-based or Surface-based (Material 3) naming. Scrim/state/shadow color aliases included.
- **Collection 3 — Typography**: configurable scale (Material 3, Fluid, Compact, or Custom), 15 roles, responsive modes from `DS.breakpoints.modes`. Every variable is a `VARIABLE_ALIAS` to a Collection 1 primitive — no raw values. Throws with a full list of missing primitives before creating any variables.
- **Collection 4 — Spacing**: responsive per `DS.breakpoints.modes` — component, layout, inset, stack, touch target, radius, and border tokens.
- **Collection 5 — Elevation**: Effect Styles with shadow offset, radius, and color all bound to variables. Shadow color updates automatically in Light/Dark mode.
- **Optional token showcase**: visual reference frame — color ramps (swatches only, no misleading isolated contrast badges), semantic pairs with actual bg/text contrast ratios, scrim demos, typography scale, spacing bars, border radius, border width, and elevation cards.

Standalone — no other figlets skill is required before or after.

```
/fig-setup                   # starts intake questionnaire
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
