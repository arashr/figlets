// create-primitives.js — Collection 1 (Primitives) builder
// Requires: DS config prepended (provided by run_skill_script from design-system.config.js)
//
// Color ramps are read from DS.color.ramps — written to config by /fig-setup
// after the ramp preview is approved. All other values are config-derived.

// ── Color ramps from DS config ────────────────────────────────────────────────
const COLOR_RAMPS = DS.color.ramps || [];

// ── Config-derived naming helpers ─────────────────────────────────────────────
// Derive the type prefix from DS.naming.textStyle: 'type/{role}/{size}' → 'type'
// This ensures all type primitive names stay in sync with the project's naming convention.

const _typePrefix   = DS.naming.textStyle.split('/')[0];
if (_typePrefix.includes('{') || _typePrefix.includes('}')) {
  throw new Error(
    `DS.naming.textStyle must start with a literal prefix, e.g. 'type/{role}/{size}'. ` +
    `Got: '${DS.naming.textStyle}' — the first segment must not be a placeholder.`
  );
}
const _familySans   = DS.naming.fontFamily.replace('{variant}', 'sans');
const _familyMono   = DS.naming.fontFamily.replace('{variant}', 'mono');
const _familySerif  = DS.naming.fontFamily.replace('{variant}', 'serif');

// ── FIXED: Scrim primitives (never change across design systems) ──────────────

const SCRIMS = [
  { name: 'color/scrim/black/4',  r: 0, g: 0, b: 0, a: 0.04 },
  { name: 'color/scrim/black/8',  r: 0, g: 0, b: 0, a: 0.08 },
  { name: 'color/scrim/black/12', r: 0, g: 0, b: 0, a: 0.12 },
  { name: 'color/scrim/black/20', r: 0, g: 0, b: 0, a: 0.20 },
  { name: 'color/scrim/black/40', r: 0, g: 0, b: 0, a: 0.40 },
  { name: 'color/scrim/black/60', r: 0, g: 0, b: 0, a: 0.60 },
  { name: 'color/scrim/white/8',  r: 1, g: 1, b: 1, a: 0.08 },
  { name: 'color/scrim/white/12', r: 1, g: 1, b: 1, a: 0.12 },
  { name: 'color/scrim/white/16', r: 1, g: 1, b: 1, a: 0.16 },
  { name: 'color/scrim/white/20', r: 1, g: 1, b: 1, a: 0.20 },
];

// ── FIXED: Shadow primitives (FLOAT) ─────────────────────────────────────────

const SHADOWS = [
  { name: 'shadow/1/offset-y',       value: 1  },
  { name: 'shadow/1/radius',         value: 2  },
  { name: 'shadow/2/offset-y',       value: 4  },
  { name: 'shadow/2/radius',         value: 8  },
  { name: 'shadow/3/offset-y',       value: 8  },
  { name: 'shadow/3/radius',         value: 16 },
  { name: 'shadow/4/offset-y',       value: 12 },
  { name: 'shadow/4/radius',         value: 24 },
  { name: 'shadow/5/offset-y',       value: 16 },
  { name: 'shadow/5/radius',         value: 32 },
  { name: 'shadow/ambient/2/radius', value: 8  },
  { name: 'shadow/ambient/3/radius', value: 12 },
  { name: 'shadow/ambient/4/radius', value: 16 },
  { name: 'shadow/ambient/5/radius', value: 20 },
];

// ── Config-derived: Type scale primitives (FLOAT + STRING) ───────────────────
// Names use _typePrefix from DS.naming.textStyle so they stay in sync with
// any naming convention (e.g. 'type/{role}/{size}' → prefix 'type').

const TYPE_WEIGHTS = [
  { name: `${_typePrefix}/weight/regular`,  value: 400 },
  { name: `${_typePrefix}/weight/medium`,   value: 500 },
  { name: `${_typePrefix}/weight/semibold`, value: 600 },
  { name: `${_typePrefix}/weight/bold`,     value: 700 },
];

const TYPE_SIZES = [
  { name: `${_typePrefix}/size/2xs`, value: 10 },
  { name: `${_typePrefix}/size/xs`,  value: 12 },
  { name: `${_typePrefix}/size/sm`,  value: 14 },
  { name: `${_typePrefix}/size/md`,  value: 16 },
  { name: `${_typePrefix}/size/lg`,  value: 18 },
  { name: `${_typePrefix}/size/xl`,  value: 20 },
  { name: `${_typePrefix}/size/2xl`, value: 24 },
  { name: `${_typePrefix}/size/3xl`, value: 30 },
  { name: `${_typePrefix}/size/4xl`, value: 36 },
  { name: `${_typePrefix}/size/5xl`, value: 48 },
  { name: `${_typePrefix}/size/6xl`, value: 60 },
  { name: `${_typePrefix}/size/7xl`, value: 72 },
];

// Line height multipliers stored as reference (px values computed in Collection 3)
const TYPE_LINE_HEIGHTS = [
  { name: `${_typePrefix}/line-height/tight`,   value: 1.2  },
  { name: `${_typePrefix}/line-height/snug`,    value: 1.35 },
  { name: `${_typePrefix}/line-height/normal`,  value: 1.5  },
  { name: `${_typePrefix}/line-height/relaxed`, value: 1.65 },
  { name: `${_typePrefix}/line-height/loose`,   value: 1.8  },
];

const TYPE_TRACKING = [
  { name: `${_typePrefix}/tracking/tight`,   value: -0.02 },
  { name: `${_typePrefix}/tracking/snug`,    value: -0.01 },
  { name: `${_typePrefix}/tracking/normal`,  value: 0     },
  { name: `${_typePrefix}/tracking/open`,    value: 0.01  },
  { name: `${_typePrefix}/tracking/wide`,    value: 0.02  },
  { name: `${_typePrefix}/tracking/wider`,   value: 0.05  },
  { name: `${_typePrefix}/tracking/widest`,  value: 0.1   },
];

// ── Extend type primitives from DS.typography.scale ──────────────────────────
// Semantic/responsive collections must ONLY use aliases — never raw values.
// This block ensures every size and tracking value used in the typography scale
// has a corresponding primitive, so create-typography-vars.js can always alias.
if (DS.typography && DS.typography.scale) {
  // Sizes: standard t-shirt scale + any custom px values (e.g. 11, 22, 57)
  const _stdSizes = new Set(TYPE_SIZES.map(t => t.value));
  const _extraSizes = new Set();
  for (const { sizes } of Object.values(DS.typography.scale)) {
    for (const sz of (sizes || [])) {
      if (typeof sz === 'number' && !_stdSizes.has(sz)) _extraSizes.add(sz);
    }
  }
  for (const sz of [..._extraSizes].sort((a, b) => a - b)) {
    // Named by px value (e.g. type/size/11, type/size/57)
    TYPE_SIZES.push({ name: `${_typePrefix}/size/${sz}`, value: sz });
  }

  // Tracking: standard semantic scale + any custom values not already covered
  const _stdTracking = new Set(TYPE_TRACKING.map(t => t.value));
  const _extraTracking = new Set();
  for (const { tracking } of Object.values(DS.typography.scale)) {
    if (typeof tracking === 'number' && !_stdTracking.has(tracking)) {
      _extraTracking.add(tracking);
    }
  }
  for (const tr of [..._extraTracking].sort((a, b) => a - b)) {
    // Named by value (e.g. type/tracking/0.03)
    TYPE_TRACKING.push({ name: `${_typePrefix}/tracking/${tr}`, value: tr });
  }
}

// Font families from DS config, variable names from DS.naming.fontFamily pattern
const TYPE_FAMILIES = [
  { name: _familySans, value: DS.typography.families.sans || 'Inter'          },
  { name: _familyMono, value: DS.typography.families.mono || 'JetBrains Mono' },
];
if (DS.typography.families.serif) {
  TYPE_FAMILIES.push({ name: _familySerif, value: DS.typography.families.serif });
}

// ── FIXED: Spacing primitives (scale from DS.grid.base) ──────────────────────

const SPACING_8 = [
  [0, 0], [1, 4], [2, 8], [3, 12], [4, 16], [5, 20], [6, 24],
  [8, 32], [10, 40], [11, 44], [12, 48], [16, 64], [20, 80], [24, 96],
  [32, 128], [40, 160], [48, 192], [64, 256],
  // space/11 = 44px — minimum touch target per WCAG 2.5.5 / WCAG 2.5.8
];

const SPACING_4 = [
  [0, 0], [0.5, 2], [1, 4], [2, 8], [3, 12], [4, 16], [5, 20],
  [6, 24], [8, 32], [10, 40], [12, 48], [16, 64], [20, 80],
  [24, 96], [32, 128],
];

// Figma rejects decimal segments in variable paths (e.g. space/0.5 throws).
// Sanitize: replace '.' with '-' so 0.5 → space/0-5, 1.5 → space/1-5.
const _sanitizeStep = (step) => String(step).replace('.', '-');

const SPACING = (DS.grid.base === 4 ? SPACING_4 : SPACING_8)
  .map(([step, value]) => ({ name: `space/${_sanitizeStep(step)}`, value }));

// ── BUILD ─────────────────────────────────────────────────────────────────────

const coll = figma.variables.createVariableCollection(DS.collections.primitives);
const modeId = coll.modes[0].modeId;
coll.renameMode(modeId, 'Default');

// Helper — create variable and set value for the single Primitives mode
function prim(name, type, value) {
  const v = figma.variables.createVariable(name, coll, type);
  v.setValueForMode(modeId, value);
  return v;
}

// Hide from publishing AFTER first variable exists (setter throws on empty collection)
// Wrapped in try/catch — throws on some Figma plan tiers
let _firstVarCreated = false;
function primSafe(name, type, value) {
  const v = prim(name, type, value);
  if (!_firstVarCreated) {
    try { coll.hiddenFromPublishing = true; } catch(e) {}
    _firstVarCreated = true;
  }
  return v;
}

// Color ramps
for (const ramp of COLOR_RAMPS) {
  for (const [step, r, g, b] of ramp.steps) {
    primSafe(`${ramp.folder}/${step}`, 'COLOR', { r, g, b, a: 1 });
  }
}

// Scrim primitives (COLOR with alpha)
for (const s of SCRIMS) {
  primSafe(s.name, 'COLOR', { r: s.r, g: s.g, b: s.b, a: s.a });
}

// Shadow primitives (FLOAT)
for (const s of SHADOWS)       { primSafe(s.name, 'FLOAT', s.value); }

// Type primitives
for (const t of TYPE_FAMILIES) { primSafe(t.name, 'STRING', t.value); }
for (const t of TYPE_WEIGHTS)  { primSafe(t.name, 'FLOAT',  t.value); }
for (const t of TYPE_SIZES)    { primSafe(t.name, 'FLOAT',  t.value); }
for (const t of TYPE_LINE_HEIGHTS) { primSafe(t.name, 'FLOAT', t.value); }
for (const t of TYPE_TRACKING) { primSafe(t.name, 'FLOAT',  t.value); }

// Spacing primitives (FLOAT)
for (const s of SPACING)       { primSafe(s.name, 'FLOAT',  s.value); }

return `Primitives built: ${coll.variableIds.length} variables in "${DS.collections.primitives}"`;
