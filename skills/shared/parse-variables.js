// parse-variables.js — shared variable map builder
// Paste at top of any use_figma script that needs variable lookups (before bind-helpers.js).
// Provides: varByName, colorVarByHex, spacingVarByValue, typographyVarByValue, rgbDist

const _allVars = await figma.variables.getLocalVariablesAsync();

// All variables indexed by name for direct lookup
const varByName = Object.fromEntries(_allVars.map(v => [v.name, v]));

// Euclidean RGB distance (inputs are 0–1 floats, distance on 0–255 scale)
function rgbDist(a, b) {
  return Math.sqrt(
    Math.pow((a.r - b.r) * 255, 2) +
    Math.pow((a.g - b.g) * 255, 2) +
    Math.pow((a.b - b.b) * 255, 2)
  );
}

// Hex helper
function _toHex(r, g, b) {
  const h = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// COLOR variables → hex map. Semantic tokens preferred over primitives when
// both resolve to the same hex (fewer path segments = more semantic).
const colorVarByHex = {};
for (const v of _allVars.filter(v => v.resolvedType === 'COLOR')) {
  const val = Object.values(v.valuesByMode)[0];
  if (!val || typeof val !== 'object' || !('r' in val)) continue;
  const hex = _toHex(val.r, val.g, val.b);
  const existing = colorVarByHex[hex];
  if (!existing || v.name.split('/').length < existing.name.split('/').length) {
    colorVarByHex[hex] = v;
  }
}

// Resolve a variable's numeric value — follows VARIABLE_ALIAS chains up to 5 levels deep.
// Multi-level chains arise when component-scoped tokens alias semantic tokens which
// alias primitives (e.g. Tag·Size → spacing/sm → spacing/base/4).
function _resolveFloat(v, _depth) {
  if (_depth === undefined) _depth = 0;
  if (_depth > 4) return null;
  const raw = Object.values(v.valuesByMode)[0];
  if (typeof raw === 'number') return raw;
  if (raw && raw.type === 'VARIABLE_ALIAS') {
    const target = _allVars.find(x => x.id === raw.id);
    if (target) return _resolveFloat(target, _depth + 1);
  }
  return null;
}

// FLOAT variables related to spacing/layout.
// When two variables share the same resolved value, prefer the more specific one
// (more path segments = component-scoped token wins over generic primitive).
const _spacingKw = /space|spacing|gap|padding|margin|radius|width|height|border/i;
const spacingVarByValue = {};
for (const v of _allVars.filter(v => v.resolvedType === 'FLOAT' && _spacingKw.test(v.name))) {
  const val = _resolveFloat(v);
  if (val === null) continue;
  const existing = spacingVarByValue[val];
  if (!existing || v.name.split('/').length > existing.name.split('/').length) {
    spacingVarByValue[val] = v;
  }
}

// FLOAT variables related to typography.
// Same specificity preference: longer path wins.
const _typographyKw = /font|size|line|tracking|letter|weight/i;
const typographyVarByValue = {};
for (const v of _allVars.filter(v => v.resolvedType === 'FLOAT' && _typographyKw.test(v.name))) {
  const val = _resolveFloat(v);
  if (val === null) continue;
  const existing = typographyVarByValue[val];
  if (!existing || v.name.split('/').length > existing.name.split('/').length) {
    typographyVarByValue[val] = v;
  }
}

// ALL FLOAT variables indexed by resolved value — no keyword filter.
// Catches component-scoped tokens (Button/*, Icon/*, etc.) that don't match
// the spacing or typography keyword patterns.
// Same specificity preference: longer path (more specific) wins.
const floatVarByValue = {};
for (const v of _allVars.filter(v => v.resolvedType === 'FLOAT')) {
  const val = _resolveFloat(v);
  if (val === null) continue;
  const existing = floatVarByValue[val];
  if (!existing || v.name.split('/').length > existing.name.split('/').length) {
    floatVarByValue[val] = v;
  }
}
