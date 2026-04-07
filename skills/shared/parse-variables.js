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

// FLOAT variables related to spacing/layout
const _spacingKw = /space|spacing|gap|padding|margin|radius|width|height|border/i;
const spacingVarByValue = {};
for (const v of _allVars.filter(v => v.resolvedType === 'FLOAT' && _spacingKw.test(v.name))) {
  const val = Object.values(v.valuesByMode)[0];
  if (typeof val === 'number') spacingVarByValue[val] = v;
}

// FLOAT variables related to typography
const _typographyKw = /font|size|line|tracking|letter|weight/i;
const typographyVarByValue = {};
for (const v of _allVars.filter(v => v.resolvedType === 'FLOAT' && _typographyKw.test(v.name))) {
  const val = Object.values(v.valuesByMode)[0];
  if (typeof val === 'number') typographyVarByValue[val] = v;
}
