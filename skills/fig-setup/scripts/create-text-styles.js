// create-text-styles.js — Figma Text Styles bound to Typography variables
// Requires: DS_CONFIG prepended (from design-system.config.js)
// Requires: Typography variable collection (Collection 3) already built
//
// fontFamily → setBoundVariable('fontFamily', STRING var) ✓
// fontSize   → setBoundVariable('fontSize',   FLOAT var)  ✓
// lineHeight → setBoundVariable('lineHeight',  FLOAT var)  ✓
// tracking   → setBoundVariable('letterSpacing', FLOAT var) ✓
// fontWeight → setBoundVariable('fontWeight', FLOAT var) ✓
//              Figma has two separate weight properties:
//                'fontStyle'  → STRING var ("Bold", "Medium") — full style name
//                'fontWeight' → FLOAT var (400, 700)          — numeric weight
//              Our weight primitives are FLOAT so 'fontWeight' is the correct key.
//              style.fontName must still be set to a valid font+style combination
//              so Figma can render the text before/without the variable resolving.
//              The font-availability fallback chain handles fonts that lack certain weights.

const allVars  = await figma.variables.getLocalVariablesAsync();
const allColls = await figma.variables.getLocalVariableCollectionsAsync();
const typoColl = allColls.find(c => c.name === DS.collections.typography);
const typoIds  = new Set(typoColl ? typoColl.variableIds : []);

// Prefer Typography collection variables so Text Styles bind to Collection 3,
// not directly to Collection 1 primitives. Falls back to any variable by name.
const findVar = (name) =>
  allVars.find(v => typoIds.has(v.id) && v.name === name) ||
  allVars.find(v => v.name === name);

// Build token name from pattern: replace {role} and {size}
function tokenName(role, size) {
  return DS.naming.textStyle.replace('{role}', role).replace('{size}', size);
}
function propVar(role, size, prop) {
  return `${tokenName(role, size)}/${prop}`;
}

// ── Resolve a variable's stored float value (follows one alias level) ─────────

function resolveFloat(variable) {
  if (!variable) return null;
  const val = Object.values(variable.valuesByMode)[0];
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
    const aliased = figma.variables.getVariableById(val.id);
    if (aliased) {
      const primVal = Object.values(aliased.valuesByMode)[0];
      if (typeof primVal === 'number') return primVal;
    }
  }
  return null;
}

// ── Font style resolution with availability fallback ──────────────────────────
//
// Many fonts omit weights (e.g. no "Medium" in Inter Tight). We check what
// styles are actually available and use the closest match.

const _familyName = DS.typography.families.sans || 'Inter';

// DS.typography.styles maps semantic weight names → font-specific style strings.
// e.g. { regular: 'Regular', medium: 'Medium', semiBold: 'Semi Bold', bold: 'Bold' }
const _weightStyleMap = {
  400: DS.typography.styles?.regular  || 'Regular',
  500: DS.typography.styles?.medium   || 'Medium',
  600: DS.typography.styles?.semiBold || 'Semi Bold',
  700: DS.typography.styles?.bold     || 'Bold',
};

// Load available fonts and build the set of styles for our family
const _allFonts      = await figma.listAvailableFontsAsync();
const _availStyles   = new Set(
  _allFonts
    .filter(f => f.fontName.family === _familyName)
    .map(f => f.fontName.style)
);

// Fallback chain: desired → Semi Bold → Bold → Regular → first available
function _resolveStyle(desired) {
  const candidates = [desired, 'Semi Bold', 'SemiBold', 'Bold', 'Regular', 'Light'];
  for (const s of candidates) {
    if (_availStyles.has(s)) return s;
  }
  return [..._availStyles][0] || 'Regular';
}

// ── Roles ─────────────────────────────────────────────────────────────────────

const roles = [
  { role: 'display',  size: 'lg' }, { role: 'display',  size: 'md' }, { role: 'display',  size: 'sm' },
  { role: 'headline', size: 'lg' }, { role: 'headline', size: 'md' }, { role: 'headline', size: 'sm' },
  { role: 'title',    size: 'lg' }, { role: 'title',    size: 'md' }, { role: 'title',    size: 'sm' },
  { role: 'body',     size: 'lg' }, { role: 'body',     size: 'md' }, { role: 'body',     size: 'sm' },
  { role: 'label',    size: 'lg' }, { role: 'label',    size: 'md' }, { role: 'label',    size: 'sm' },
];

// Use scale roles from config if available (overrides default 15-role set)
const _scaleRoles = DS.typography?.scale
  ? Object.keys(DS.typography.scale).map(key => {
      const [role, size] = key.split('/');
      return { role, size };
    })
  : roles;

// ── Pre-load all fonts before the loop ───────────────────────────────────────
// figma.loadFontAsync must be called before createTextStyle / fontName / setBoundVariable.
// We collect every unique {family, style} combination needed, then load them all
// in parallel with Promise.all — avoids sequential loading and duplicate loads
// when multiple roles share the same weight.

const _fontsNeeded = new Map(); // key → { family, style }
for (const { role, size } of _scaleRoles) {
  const weightVar     = findVar(propVar(role, size, 'weight'));
  const weightNumeric = resolveFloat(weightVar);
  const desiredStyle  = _weightStyleMap[weightNumeric] || 'Regular';
  const resolvedStyle = _resolveStyle(desiredStyle);
  const key           = `${_familyName}::${resolvedStyle}`;
  if (!_fontsNeeded.has(key)) {
    _fontsNeeded.set(key, { family: _familyName, style: resolvedStyle });
  }
}
await Promise.all([..._fontsNeeded.values()].map(f => figma.loadFontAsync(f)));

// ── Build text styles ─────────────────────────────────────────────────────────

let built = 0;
const warnings = [];

for (const { role, size } of _scaleRoles) {
  const styleName = tokenName(role, size);
  const style = figma.createTextStyle();
  style.name = styleName;

  const sizeVar   = findVar(propVar(role, size, 'size'));
  const lhVar     = findVar(propVar(role, size, 'line-height'));
  const trackVar  = findVar(propVar(role, size, 'tracking'));
  const weightVar = findVar(propVar(role, size, 'weight'));
  const familyVar = findVar(DS.naming.fontFamily.replace('{variant}', 'sans'));

  // Resolve numeric weight → font style string (fonts already loaded above)
  const weightNumeric = resolveFloat(weightVar);
  const desiredStyle  = _weightStyleMap[weightNumeric] || 'Regular';
  const resolvedStyle = _resolveStyle(desiredStyle);

  if (resolvedStyle !== desiredStyle) {
    warnings.push(`${styleName}: weight ${weightNumeric} → "${desiredStyle}" not found, using "${resolvedStyle}"`);
  }

  // Set fontName (font is guaranteed loaded), then bind all properties to variables
  style.fontName = { family: _familyName, style: resolvedStyle };

  if (familyVar) await style.setBoundVariable('fontFamily',    familyVar);
  if (weightVar) await style.setBoundVariable('fontWeight',    weightVar);
  if (sizeVar)   await style.setBoundVariable('fontSize',      sizeVar);
  if (lhVar)     await style.setBoundVariable('lineHeight',    lhVar);
  if (trackVar)  await style.setBoundVariable('letterSpacing', trackVar);

  if (!sizeVar || !lhVar || !weightVar || !familyVar) {
    warnings.push(`${styleName}: missing variable(s) — check Typography collection and naming config`);
  }

  built++;
}

const summary = `Text styles built: ${built} styles for "${_familyName}".`;
const warn    = warnings.length ? `\nWarnings (${warnings.length}):\n` + warnings.map(w => `  • ${w}`).join('\n') : '';
return summary + warn;
