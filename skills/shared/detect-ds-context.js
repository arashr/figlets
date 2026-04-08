// detect-ds-context.js — shared runtime DS context for fig-create, fig-qa, fig-document.
//
// Paste at the top of any use_figma script that needs to adapt to the current DS.
// All maps are exposed as top-level consts for direct use, AND bundled in DS_CONTEXT
// for passing to functions or returning from scripts.
//
// Detection philosophy: inspect what the file actually provides — no assumptions about
// how the DS was built. Works with fig-setup DSes, third-party DSes, or hand-crafted ones.
//
// Provides:
//   varByName           — all variables keyed by name
//   colorVarByHex       — COLOR variables keyed by hex; semantic preferred (fewer segments)
//   floatVarByValue     — ALL FLOAT variables keyed by resolved value; specific wins (more segments)
//   typographyVarByValue— FLOAT vars with font/size/line/tracking/letter/weight in name
//   spacingVarByValue   — FLOAT vars with space/spacing/gap/padding/margin/radius/border in name
//   textStyleByName     — local text styles keyed by name
//   hasTextStyles       — true if the file has any local text styles
//   effectStyleByName   — local effect styles keyed by name
//   hasEffectStyles     — true if the file has any local effect styles
//   collectionByName    — variable collections keyed by name
//   typographyStrategy  — 'text-styles' | 'variables' | 'none'
//   rgbDist(a,b)        — Euclidean RGB distance helper (inputs are {r,g,b} 0-1 floats)

const _allVars        = await figma.variables.getLocalVariablesAsync();
const _allColls       = await figma.variables.getLocalVariableCollectionsAsync();
const _allTextStyles  = await figma.getLocalTextStylesAsync();
const _allEffectStyles= await figma.getLocalEffectStylesAsync();

// ── Helpers ───────────────────────────────────────────────────────────────────

function rgbDist(a, b) {
  return Math.sqrt(
    Math.pow((a.r - b.r) * 255, 2) +
    Math.pow((a.g - b.g) * 255, 2) +
    Math.pow((a.b - b.b) * 255, 2)
  );
}

function _toHex(r, g, b) {
  const h = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Resolve a FLOAT variable's value — follows VARIABLE_ALIAS chains up to 5 levels deep.
// Multi-level chains arise when component-scoped tokens alias semantic tokens which
// alias primitives (e.g. Tag·Size → spacing/sm → spacing/base/4).
function _resolveFloat(v, _depth) {
  if (_depth === undefined) _depth = 0;
  if (_depth > 4) return null;
  const raw = Object.values(v.valuesByMode)[0];
  if (typeof raw === 'number') return raw;
  if (raw?.type === 'VARIABLE_ALIAS') {
    const target = _allVars.find(x => x.id === raw.id);
    if (target) return _resolveFloat(target, _depth + 1);
  }
  return null;
}

// ── varByName ─────────────────────────────────────────────────────────────────

const varByName = Object.fromEntries(_allVars.map(v => [v.name, v]));

// ── colorVarByHex ─────────────────────────────────────────────────────────────
// Prefer semantic over primitive when both resolve to the same hex
// (fewer path segments = more semantic / closer to intent).

const colorVarByHex = {};
for (const v of _allVars.filter(v => v.resolvedType === 'COLOR')) {
  const val = Object.values(v.valuesByMode)[0];
  if (!val || typeof val !== 'object' || !('r' in val)) continue;
  const hex = _toHex(val.r, val.g, val.b);
  const ex = colorVarByHex[hex];
  if (!ex || v.name.split('/').length < ex.name.split('/').length) colorVarByHex[hex] = v;
}

// ── floatVarByValue ───────────────────────────────────────────────────────────
// All FLOAT variables — no keyword filter. Covers component-scoped tokens.
// More specific (more path segments) wins when values collide.

const floatVarByValue = {};
for (const v of _allVars.filter(v => v.resolvedType === 'FLOAT')) {
  const val = _resolveFloat(v);
  if (val === null) continue;
  const ex = floatVarByValue[val];
  if (!ex || v.name.split('/').length > ex.name.split('/').length) floatVarByValue[val] = v;
}

// ── typographyVarByValue ──────────────────────────────────────────────────────
// FLOAT variables whose name suggests a typography property.
// Used as fallback when DS has no text styles.

const _typKw = /font|size|line|tracking|letter|weight/i;
const typographyVarByValue = {};
for (const v of _allVars.filter(v => v.resolvedType === 'FLOAT' && _typKw.test(v.name))) {
  const val = _resolveFloat(v);
  if (val === null) continue;
  const ex = typographyVarByValue[val];
  if (!ex || v.name.split('/').length > ex.name.split('/').length) typographyVarByValue[val] = v;
}

// ── spacingVarByValue ─────────────────────────────────────────────────────────
// FLOAT variables whose name suggests a layout / spacing property.

const _spcKw = /space|spacing|gap|padding|margin|radius|width|height|border/i;
const spacingVarByValue = {};
for (const v of _allVars.filter(v => v.resolvedType === 'FLOAT' && _spcKw.test(v.name))) {
  const val = _resolveFloat(v);
  if (val === null) continue;
  const ex = spacingVarByValue[val];
  if (!ex || v.name.split('/').length > ex.name.split('/').length) spacingVarByValue[val] = v;
}

// ── Text styles ───────────────────────────────────────────────────────────────

const hasTextStyles    = _allTextStyles.length > 0;
const textStyleByName  = Object.fromEntries(_allTextStyles.map(s => [s.name, s]));

// ── Effect styles ─────────────────────────────────────────────────────────────

const hasEffectStyles   = _allEffectStyles.length > 0;
const effectStyleByName = Object.fromEntries(_allEffectStyles.map(s => [s.name, s]));

// ── Collections ───────────────────────────────────────────────────────────────

const collectionByName = Object.fromEntries(_allColls.map(c => [c.name, c]));

// ── Typography strategy ───────────────────────────────────────────────────────
// 'text-styles' — file has local text styles → use textStyleId on text nodes.
// 'variables'   — no text styles but FLOAT typography variables exist → bind fontSize etc.
// 'none'        — neither → flag as token gap, do not hardcode.

const typographyStrategy = hasTextStyles
  ? 'text-styles'
  : Object.keys(typographyVarByValue).length > 0
    ? 'variables'
    : 'none';

// ── DS_CONTEXT bundle ─────────────────────────────────────────────────────────

const DS_CONTEXT = {
  varByName, colorVarByHex, floatVarByValue, typographyVarByValue, spacingVarByValue,
  textStyleByName, hasTextStyles,
  effectStyleByName, hasEffectStyles,
  collectionByName,
  typographyStrategy,
  rgbDist,
};
