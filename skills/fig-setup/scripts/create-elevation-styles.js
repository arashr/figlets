// Create Figma Effect Styles for elevation/0 through elevation/5.
// Requires shadow primitive variables (Collection 1) and color/shadow/* aliases (Collection 2).

const allVars = await figma.variables.getLocalVariablesAsync();

// Null-safe binder — if variable not found, returns effect unchanged (prevents silent unbind)
function bindEffectField(eff, field, varName) {
  const v = allVars.find(v => v.name === varName);
  if (!v) { console.warn(`bindEffectField: variable not found: ${varName}`); return eff; }
  return figma.variables.setBoundVariableForEffect(eff, field, v);
}

// Level 0 — no shadow
const style0 = figma.createEffectStyle();
style0.name = 'elevation/0';
style0.effects = [];

// Levels 1–5
const levels = [
  { level: 1, oy: 'shadow/1/offset-y', r: 'shadow/1/radius', ambient: null },
  { level: 2, oy: 'shadow/2/offset-y', r: 'shadow/2/radius', ambient: 'shadow/ambient/2/radius' },
  { level: 3, oy: 'shadow/3/offset-y', r: 'shadow/3/radius', ambient: 'shadow/ambient/3/radius' },
  { level: 4, oy: 'shadow/4/offset-y', r: 'shadow/4/radius', ambient: 'shadow/ambient/4/radius' },
  { level: 5, oy: 'shadow/5/offset-y', r: 'shadow/5/radius', ambient: 'shadow/ambient/5/radius' },
];

for (const def of levels) {
  const style = figma.createEffectStyle();
  style.name = `elevation/${def.level}`;

  // Build key shadow — chain bindEffectField calls sequentially
  // Each call's return value feeds the next call (unintended-unbind prevention)
  // Bind color via the semantic variable — when the frame's mode switches Light ↔ Dark,
  // Figma re-evaluates the binding and the shadow color updates automatically.
  let keyEff = { type: 'DROP_SHADOW', color: {r:0,g:0,b:0,a:0.2},
                 offset: {x:0, y:1}, radius: 2, spread: 0,
                 visible: true, blendMode: 'NORMAL' };
  keyEff = bindEffectField(keyEff, 'offsetY', def.oy);
  keyEff = bindEffectField(keyEff, 'radius',  def.r);
  keyEff = bindEffectField(keyEff, 'color',   'color/shadow/key');

  const effects = [keyEff];

  if (def.ambient) {
    let ambEff = { type: 'DROP_SHADOW', color: {r:0,g:0,b:0,a:0.08},
                   offset: {x:0, y:0}, radius: 4, spread: 0,
                   visible: true, blendMode: 'NORMAL' };
    ambEff = bindEffectField(ambEff, 'radius', def.ambient);
    ambEff = bindEffectField(ambEff, 'color',  'color/shadow/ambient');
    effects.push(ambEff);
  }

  style.effects = effects;
}
