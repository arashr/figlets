// showcase-color.js — Color token showcase
// Section A: Primitive color ramps — color + hex + step name. NO contrast badges.
// Section B: Semantic bg/text pairs — pair contrast ratio badge only.
//
// ACCESSIBILITY RULE (enforced here, guardrailed in SKILL.md PRE-FLIGHT rule 9):
//
//   A single color has no accessibility value in isolation.
//   WCAG contrast only has meaning between a FOREGROUND and a BACKGROUND.
//
//   Section A shows what colors exist — not whether they're accessible.
//   The contrast analysis for which steps are usable as text belongs in the
//   intake preview chat (Phase 1A), not as Figma badges on primitive swatches.
//
//   Section B computes contrast ONLY between the paired bg and text semantic
//   variables. Never against a fixed reference (white or black).

// ── Utilities ─────────────────────────────────────────────────────────────────

function _hex({ r, g, b }) {
  const h = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Resolve a COLOR variable to its {r,g,b} value, following one alias level.
// Semantic variables alias → primitive; primitives hold the raw value.
function _resolveColor(variable, modeId) {
  const val = variable.valuesByMode[modeId ?? Object.keys(variable.valuesByMode)[0]];
  if (!val) return null;
  if (typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    const aliased = figma.variables.getVariableById(val.id);
    if (!aliased) return null;
    const primMode = Object.keys(aliased.valuesByMode)[0];
    return aliased.valuesByMode[primMode];
  }
  return val; // { r, g, b, a }
}

// WCAG 2.2 relative luminance
function _luminance({ r, g, b }) {
  return [r, g, b]
    .map(c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

// WCAG 2.2 contrast ratio between two resolved {r,g,b} color objects
function _contrastRatio(c1, c2) {
  const L1 = _luminance(c1), L2 = _luminance(c2);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

// ── Section A — Primitive Ramps ───────────────────────────────────────────────
//
// One row per ramp (primary, neutral, etc). Each step = swatch + step name + hex.
// No contrast badges — primitives are raw palette data, not paired tokens.
//
// Pattern for each step:
//
//   const col = figma.createFrame();
//   col.layoutMode = 'VERTICAL';
//   col.itemSpacing = 4;                // structural — gap between swatch and labels
//   col.fills = [];
//
//   const swatch = figma.createFrame();
//   swatch.resize(56, 56);             // structural — documented swatch size
//   const swatchPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
//   swatch.fills = [swatchPaint];
//   swatch.setBoundVariableForPaint(swatch.fills[0], 'color', varByName[primVarName]);
//
//   const stepLabel = figma.createText();
//   stepLabel.characters = stepName;    // e.g. '500'
//   // bind textStyleId to label/sm text style
//
//   const hexLabel = figma.createText();
//   // Resolved at build time for reference only — not a live binding
//   const resolved = _resolveColor(varByName[primVarName]);
//   hexLabel.characters = resolved ? _hex(resolved) : '';
//   // bind textStyleId to label/xs text style
//
//   col.appendChild(swatch);
//   col.appendChild(stepLabel);
//   col.appendChild(hexLabel);
//   // append col to the ramp row

// ── Section B — Semantic Pairs ────────────────────────────────────────────────
//
// One card per semantic role. Shows a large bg-colored card with sample text
// rendered in the fg color — then a contrast badge showing the PAIR ratio.
//
// The badge computes: contrastRatio(bgVar resolved, textVar resolved).
// It does NOT compare against white or black — the pair IS the test.
//
// Standard pairs (role-based naming):
const SEMANTIC_PAIRS = [
  { label: 'default', bg: 'color/bg/default',        fg: 'color/text/default'    },
  { label: 'subtle',  bg: 'color/bg/subtle',          fg: 'color/text/default'    },
  { label: 'brand',   bg: 'color/bg/brand',           fg: 'color/text/on-brand'   },
  { label: 'danger',  bg: 'color/bg/danger',          fg: 'color/text/on-danger'  },
  { label: 'success', bg: 'color/bg/success',         fg: 'color/text/on-success' },
  { label: 'warning', bg: 'color/bg/warning',         fg: 'color/text/on-warning' },
  { label: 'info',    bg: 'color/bg/info',            fg: 'color/text/on-info'    },
];
// Surface-based naming fallbacks (Material 3 style, try if role-based miss)
const SEMANTIC_PAIRS_SURFACE = [
  { label: 'default', bg: 'color/surface/default',   fg: 'color/on-surface/default'   },
  { label: 'subtle',  bg: 'color/surface/subtle',    fg: 'color/on-surface/default'   },
  { label: 'brand',   bg: 'color/surface/brand',     fg: 'color/on-surface/brand'     },
  { label: 'danger',  bg: 'color/surface/danger',    fg: 'color/on-surface/danger'    },
  { label: 'success', bg: 'color/surface/success',   fg: 'color/on-surface/success'   },
  { label: 'warning', bg: 'color/surface/warning',   fg: 'color/on-surface/warning'   },
  { label: 'info',    bg: 'color/surface/info',      fg: 'color/on-surface/info'      },
];

// Pick the naming convention by checking which bg variables exist
const _pairsToUse = SEMANTIC_PAIRS.some(p => varByName[p.bg])
  ? SEMANTIC_PAIRS
  : SEMANTIC_PAIRS_SURFACE;

// Find the semantic collection and its Light mode ID
const _semanticColl = (await figma.variables.getLocalVariableCollectionsAsync())
  .find(c => c.name === DS.collections.semantics);
const _lightModeId = _semanticColl
  ? (_semanticColl.modes.find(m => /light/i.test(m.name)) || _semanticColl.modes[0]).modeId
  : null;

//
// Pattern for each pair:
//
//   const { label, bg, fg } = pair;
//   const bgVar  = varByName[bg];
//   const fgVar  = varByName[fg];
//   if (!bgVar || !fgVar) return; // skip missing pairs gracefully
//
//   // Resolve for contrast calculation (build-time, Light mode)
//   const bgRgb = _resolveColor(bgVar, _lightModeId);
//   const fgRgb = _resolveColor(fgVar, _lightModeId);
//   const ratio = (bgRgb && fgRgb) ? _contrastRatio(bgRgb, fgRgb) : null;
//   const passAA  = ratio !== null && ratio >= 4.5;
//   const passAAA = ratio !== null && ratio >= 7;
//
//   // Card: large bg-colored frame with sample text
//   const card = figma.createFrame();
//   card.resize(160, 100);             // structural — documented card size
//   card.cornerRadius = 8;             // structural — documented exception
//   const cardPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } };
//   card.fills = [cardPaint];
//   card.setBoundVariableForPaint(card.fills[0], 'color', bgVar);
//   card.layoutMode = 'VERTICAL';
//   card.primaryAxisAlignItems = 'CENTER';
//   card.counterAxisAlignItems = 'CENTER';
//   card.itemSpacing = 4;              // structural
//
//   // Sample text rendered in fg color
//   const sampleText = figma.createText();
//   sampleText.characters = label;
//   // bind sampleText.fills[0] 'color' → fgVar
//   // bind sampleText.textStyleId → label/md style
//
//   const sampleSub = figma.createText();
//   sampleSub.characters = 'Aa 123';
//   // bind sampleSub.fills[0] 'color' → fgVar
//   // bind sampleSub.textStyleId → label/sm style
//
//   card.appendChild(sampleText);
//   card.appendChild(sampleSub);
//
//   // Contrast badge — PAIR ratio, not vs white/black
//   const badgeText = ratio !== null
//     ? `${ratio.toFixed(1)}:1 ${passAA ? '✓ AA' : '✗ FAIL'}${passAAA ? ' AAA' : ''}`
//     : 'n/a';
//
//   const badge = figma.createFrame();
//   // fill badge → passAA ? successSubtleVar : dangerSubtleVar
//   const badgeLabel = figma.createText();
//   badgeLabel.characters = badgeText;
//   // fill badgeLabel → passAA ? textSuccessVar : textDangerVar
//   badge.appendChild(badgeLabel);
//
//   // Stack: card + label below + badge below
//   const pairCol = figma.createFrame();
//   pairCol.layoutMode = 'VERTICAL';
//   pairCol.itemSpacing = 8;           // structural
//   pairCol.fills = [];
//   pairCol.appendChild(card);
//   pairCol.appendChild(nameLabel);    // e.g. 'default'
//   pairCol.appendChild(badge);
//
// ── Note on dark mode ─────────────────────────────────────────────────────────
//
// The badge is computed at build time using Light mode values for display.
// The semantic variables themselves respond to mode switching live in Figma.
// To verify dark mode contrast, switch the showcase frame's mode to Dark
// and visually inspect — or rebuild the badge block with dark mode resolved values.
//
// Dark mode has stricter perceptual requirements (APCA Lc 75+ for body text)
// because light-on-dark pairs need higher luminance contrast to feel legible.
// If any pair produces a ratio below 4.5:1 in dark mode, flag it.
