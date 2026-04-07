// create-typography-vars.js — Collection 3 (Typography) builder
// Requires: DS_CONFIG pasted above (from design-system.config.js)
// Requires: Collection 1 (Primitives) to already exist in the file
//
// Alias strategy:
//   weight      → {typePrefix}/weight/* — looked up by name, immune to float drift
//   tracking    → {typePrefix}/tracking/* — looked up by name; throws if primitive missing
//   family      → DS.naming.fontFamily (sans variant) — aliased to primitive
//   size        → {typePrefix}/size/* — t-shirt name or numeric suffix; throws if missing
//   line-height → raw px per mode (primitives store ratio multipliers, not px values)
//
// RULE: Every variable in this collection MUST be a VARIABLE_ALIAS to a Collection 1
// primitive. The ONLY permitted raw values are line-heights (computed px, inexpressible
// as a ratio primitive). If a required primitive is missing, this script throws — fix
// create-primitives.js first, then rebuild Collection 1.
//
// Scale data comes from DS.typography.scale — set during fig-setup intake (Q9).
// Mode names come from DS.breakpoints.modes — matches Collection 3, 4 exactly.

// ── Config-derived naming helpers ─────────────────────────────────────────────

const _typePrefix     = DS.naming.textStyle.split('/')[0];
const _familySansPrim = DS.naming.fontFamily.replace('{variant}', 'sans');

// ── Load all primitive variables once ────────────────────────────────────────

const allPrimVars = await figma.variables.getLocalVariablesAsync();

// Find a primitive variable by its full name
const findPrim = (name) => allPrimVars.find(v => v.name === name) || null;

// Shorthand: find by suffix under the type prefix (e.g. 'weight/bold')
const prim = (suffix) => findPrim(`${_typePrefix}/${suffix}`);

// ── Require a primitive — throws if missing (no silent raw fallback) ──────────
//
// Semantic collections are aliases only. If a required primitive doesn't exist
// it means create-primitives.js was run before DS.typography.scale was complete,
// or the scale was changed after primitives were built. Rebuild Collection 1 first.

function requireAlias(variable, context) {
  if (!variable) {
    throw new Error(
      `Missing primitive for "${context}". ` +
      `Run create-primitives.js first (with DS.typography.scale populated), ` +
      `then rebuild this collection.`
    );
  }
  return { type: 'VARIABLE_ALIAS', id: variable.id };
}

// ── Primitive lookup helpers (name-based, immune to 32-bit float precision) ───
//
// We look up primitives by their known variable NAMES rather than reading their
// stored float values back from Figma. This avoids the 32-bit precision drift
// where Figma returns -0.019999999552965164 for a variable set to -0.02,
// which would cause value-keyed lookups to silently miss.

// weight: numeric value → primitive variable
const WEIGHT_MAP = {
  400: prim('weight/regular'),
  500: prim('weight/medium'),
  600: prim('weight/semibold'),
  700: prim('weight/bold'),
};

// tracking: JS value → primitive variable
// Standard semantic names first; falls back to numeric name (e.g. type/tracking/0.03)
// for any custom values that create-primitives.js added from DS.typography.scale.
const TRACKING_SEMANTIC = {
  '-0.02': 'tight', '-0.01': 'snug', '0': 'normal',
  '0.01':  'open',  '0.02':  'wide', '0.05': 'wider', '0.1': 'widest',
};
function trackingPrim(value) {
  const key     = String(value);
  const semName = TRACKING_SEMANTIC[key];
  return semName ? prim(`tracking/${semName}`) : prim(`tracking/${value}`);
}

// size: numeric px value → primitive variable
// Standard t-shirt scale matched by name; custom sizes (e.g. 57px) matched by
// numeric suffix — create-primitives.js names them type/size/57 for non-standard.
const SIZE_TSHIRT = {
  10: 'size/2xs', 12: 'size/xs',  14: 'size/sm',  16: 'size/md',
  18: 'size/lg',  20: 'size/xl',  24: 'size/2xl', 30: 'size/3xl',
  36: 'size/4xl', 48: 'size/5xl', 60: 'size/6xl', 72: 'size/7xl',
};
function sizePrim(px) {
  const tshirt = SIZE_TSHIRT[px];
  return tshirt ? prim(tshirt) : prim(`size/${px}`);
}

// ── Pre-validate: all alias targets must exist before creating any variables ──
//
// Collect every primitive name this script will reference, check them all
// against Collection 1 in one pass, and throw with the full missing list.
// A missing primitive caught here is a config fix; caught mid-build it leaves
// a half-created collection that must be manually deleted.

{
  const _primNames   = new Set(allPrimVars.map(v => v.name));
  const _required    = new Set();

  // Family
  _required.add(_familySansPrim);

  // Weight — fixed set of four
  for (const suffix of ['weight/regular', 'weight/medium', 'weight/semibold', 'weight/bold']) {
    _required.add(`${_typePrefix}/${suffix}`);
  }

  // Size + tracking — every value used in the scale
  for (const { sizes, tracking } of Object.values(DS.typography.scale)) {
    for (const sz of (sizes || [])) {
      const tshirt = { 10:'size/2xs',12:'size/xs',14:'size/sm',16:'size/md',18:'size/lg',
                       20:'size/xl',24:'size/2xl',30:'size/3xl',36:'size/4xl',
                       48:'size/5xl',60:'size/6xl',72:'size/7xl' }[sz];
      _required.add(`${_typePrefix}/${tshirt ?? `size/${sz}`}`);
    }
    if (typeof tracking === 'number') {
      const sem = {'-0.02':'tight','-0.01':'snug','0':'normal',
                   '0.01':'open','0.02':'wide','0.05':'wider','0.1':'widest'}[String(tracking)];
      _required.add(`${_typePrefix}/${sem ? `tracking/${sem}` : `tracking/${tracking}`}`);
    }
  }

  const _missing = [..._required].filter(n => !_primNames.has(n));
  if (_missing.length > 0) {
    throw new Error(
      `create-typography-vars: ${_missing.length} required primitive(s) missing from Collection 1.\n` +
      `Rebuild Collection 1 (create-primitives.js) before running this script.\n` +
      `Missing:\n${_missing.map(n => `  • ${n}`).join('\n')}`
    );
  }
}

// ── Build token name from DS naming config ────────────────────────────────────

function tokenName(role, size) {
  return DS.naming.textStyle
    .replace('{role}', role)
    .replace('{size}', size);
}

// ── Modes from DS.breakpoints.modes ──────────────────────────────────────────

const MODES = DS.breakpoints.modes;

const coll    = figma.variables.createVariableCollection(DS.collections.typography);
const modeIds = {};

coll.renameMode(coll.modes[0].modeId, MODES[0]);
modeIds[MODES[0]] = coll.modes[0].modeId;
for (let i = 1; i < MODES.length; i++) {
  modeIds[MODES[i]] = coll.addMode(MODES[i]);
}

// Set the same alias on every mode (weight, tracking, family are mode-invariant)
function setAllModes(variable, value) {
  for (const modeId of Object.values(modeIds)) variable.setValueForMode(modeId, value);
}

// ── Build variables from DS.typography.scale ──────────────────────────────────

let built = 0;

for (const [key, { weight, tracking, sizes, lineHeights }] of Object.entries(DS.typography.scale)) {
  const [role, size] = key.split('/');
  const base = tokenName(role, size);

  // size — MUST alias to a primitive; throws if primitive missing
  const szVar = figma.variables.createVariable(`${base}/size`, coll, 'FLOAT');
  for (let i = 0; i < MODES.length; i++) {
    const sz = sizes[i] ?? sizes[sizes.length - 1];
    szVar.setValueForMode(modeIds[MODES[i]], requireAlias(sizePrim(sz), `${_typePrefix}/size/${sz}`));
  }

  // line-height — intentionally raw px (ratio primitives can't express this)
  const lhVar = figma.variables.createVariable(`${base}/line-height`, coll, 'FLOAT');
  for (let i = 0; i < MODES.length; i++) {
    const lh = lineHeights[i] ?? lineHeights[lineHeights.length - 1];
    lhVar.setValueForMode(modeIds[MODES[i]], lh);
  }

  // weight — MUST alias; all four standard weights always have primitives
  const wtVar = figma.variables.createVariable(`${base}/weight`, coll, 'FLOAT');
  setAllModes(wtVar, requireAlias(WEIGHT_MAP[weight], `${_typePrefix}/weight/${weight}`));

  // tracking — MUST alias; create-primitives.js guarantees a primitive for every
  // value in DS.typography.scale (semantic name or numeric fallback)
  const trVar = figma.variables.createVariable(`${base}/tracking`, coll, 'FLOAT');
  setAllModes(trVar, requireAlias(trackingPrim(tracking), `${_typePrefix}/tracking/${tracking}`));

  built += 4;
}

// family — STRING variable aliased to the Collection 1 family primitive
// create-text-styles.js binds Text Styles to this var: Text Style → Typo → Primitive
const familyVar = figma.variables.createVariable(_familySansPrim, coll, 'STRING');
setAllModes(familyVar, requireAlias(findPrim(_familySansPrim), _familySansPrim));
built++;

return `Typography built: ${built} variables in "${DS.collections.typography}" ` +
  `(${MODES.length} modes: ${MODES.join('/')}). ` +
  `All weight/tracking/size/family vars are VARIABLE_ALIAS to primitives. ` +
  `Line-height is raw px per mode (by design).`;
