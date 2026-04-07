// detect-design-system.js — interrogates the open Figma file to auto-populate
// as much of design-system.config.js as possible without asking the user.
// Returns a JSON string with detected fields + _meta explaining what was found.
// Fields that cannot be auto-detected are set to null (require user input).

const _textStyles   = await figma.getLocalTextStylesAsync();
const _effectStyles = await figma.getLocalEffectStylesAsync();
const _collections  = await figma.variables.getLocalVariableCollectionsAsync();
const _allVars      = await figma.variables.getLocalVariablesAsync();

const detected = {
  project:    { name: null, platform: null },
  grid:       { base: null },
  breakpoints:{ tier: null, modes: null },
  color:      { scale: null, brand: { primary: null, secondary: null, accent: null }, semanticStyle: null },
  typography: { families: { sans: null, mono: null, serif: null }, styles: { regular: null, medium: null, semiBold: null, bold: null }, scale: null },
  collections:{ primitives: null, color: null, typography: null, spacing: null, elevation: null },
  naming:     { textStyle: null, colorSemantic: null, spacingToken: null, elevationStyle: null,
                shadowKey: null, shadowAmbient: null, shadowPrimitive: null, fontFamily: null },
  sections:   { components: null, documentation: null, showcase: null },
  _meta: { hasExistingSystem: false, detectedFields: [], needsInput: [] }
};

// ── Font families from text styles ────────────────────────────────────────────
if (_textStyles.length > 0) {
  const families = [...new Set(_textStyles.map(s => s.fontName?.family).filter(Boolean))];
  const styles   = [...new Set(_textStyles.map(s => s.fontName?.style).filter(Boolean))];
  detected.typography.families.sans = families[0] || null;
  if (families.length > 1) detected.typography.families.secondary = families[1];
  // Detect style weights
  if (styles.find(s => /^regular$/i.test(s)))    detected.typography.styles.regular  = styles.find(s => /^regular$/i.test(s));
  if (styles.find(s => /^medium$/i.test(s)))     detected.typography.styles.medium   = styles.find(s => /^medium$/i.test(s));
  if (styles.find(s => /semi.?bold/i.test(s)))   detected.typography.styles.semiBold = styles.find(s => /semi.?bold/i.test(s));
  if (styles.find(s => /^bold$/i.test(s)))       detected.typography.styles.bold     = styles.find(s => /^bold$/i.test(s));
  detected._meta.detectedFields.push('typography.families', 'typography.styles');
  detected._meta.hasExistingSystem = true;
}

// ── Collection names ──────────────────────────────────────────────────────────
for (const c of _collections) {
  const n = c.name.toLowerCase();
  if (n.includes('primitive'))                        { detected.collections.primitives  = c.name; }
  else if (n.includes('color') || n.includes('semantic')) { detected.collections.color  = c.name; }
  else if (n.includes('typograph') || n.includes('type')) { detected.collections.typography = c.name; }
  else if (n.includes('spacing') || n.includes('space'))  { detected.collections.spacing   = c.name; }
  else if (n.includes('elevation') || n.includes('shadow')){ detected.collections.elevation = c.name; }
}
if (_collections.length > 0) {
  detected._meta.detectedFields.push('collections');
  detected._meta.hasExistingSystem = true;
}

// ── Breakpoint tier + mode names from Typography collection modes ─────────────
const typeColl = _collections.find(c => c.name === detected.collections.typography);
if (typeColl) {
  const modeCount = typeColl.modes.length;
  detected.breakpoints.tier  = modeCount >= 4 ? 4 : 3;
  detected.breakpoints.modes = typeColl.modes.map(m => m.name);
  detected._meta.detectedFields.push('breakpoints.tier', 'breakpoints.modes');
}

// ── Text style naming pattern ─────────────────────────────────────────────────
if (_textStyles.length > 0) {
  // Sort by name length to get a typical example (not shortest/longest)
  const sample = _textStyles.slice().sort((a, b) => a.name.length - b.name.length)[Math.floor(_textStyles.length / 2)];
  const parts = sample.name.split('/');
  if (parts.length >= 2) {
    // Replace last segment with {size}, second-to-last with {role}
    const pattern = [...parts.slice(0, -2), '{role}', '{size}'].join('/');
    detected.naming.textStyle = pattern;
    detected._meta.detectedFields.push('naming.textStyle');
  }
}

// ── Elevation style naming + shadow variable names ────────────────────────────
if (_effectStyles.length > 0) {
  const sample = _effectStyles[0].name;
  const parts  = sample.split('/');
  if (parts.length >= 1) {
    const pattern = [...parts.slice(0, -1), '{level}'].join('/');
    detected.naming.elevationStyle = pattern;
    detected._meta.detectedFields.push('naming.elevationStyle');
  }
}
const _shadowVars = _allVars.filter(v => v.name.toLowerCase().includes('shadow'));
if (_shadowVars.length > 0) {
  detected.naming.shadowKey     = _shadowVars.find(v => v.name.includes('key'))?.name     || null;
  detected.naming.shadowAmbient = _shadowVars.find(v => v.name.includes('ambient'))?.name || null;
  if (detected.naming.shadowKey || detected.naming.shadowAmbient) detected._meta.detectedFields.push('naming.shadow');
}

// ── Color scale from primitive ramp step count ────────────────────────────────
const _colorVars   = _allVars.filter(v => v.resolvedType === 'COLOR');
const _rampSteps   = new Set(_colorVars.map(v => v.name.split('/').pop()).filter(s => /^\d+$/.test(s)));
if (_rampSteps.size >= 11)     detected.color.scale = 11;
else if (_rampSteps.size >= 9) detected.color.scale = _rampSteps.has('50') ? 10 : 9;
if (detected.color.scale) detected._meta.detectedFields.push('color.scale');

// ── Semantic naming style (role-based vs surface-based) ───────────────────────
const _semanticVars = _allVars.filter(v => v.name.includes('color/'));
if (_semanticVars.length > 0) {
  const hasSurface = _semanticVars.some(v => v.name.includes('color/surface'));
  const hasOnSurface = _semanticVars.some(v => v.name.includes('color/on-surface'));
  detected.color.semanticStyle = (hasSurface && hasOnSurface) ? 'surface' : 'role';
  detected._meta.detectedFields.push('color.semanticStyle');
}

// ── Spacing variable naming ───────────────────────────────────────────────────
const _spacingVars = _allVars.filter(v => v.resolvedType === 'FLOAT' && /space|spacing/i.test(v.name));
if (_spacingVars.length > 0) {
  const sampleName = _spacingVars[0].name;
  const parts = sampleName.split('/');
  const pattern = [...parts.slice(0, -1), '{size}'].join('/');
  detected.naming.spacingToken = pattern;
  detected._meta.detectedFields.push('naming.spacingToken');
}

// ── Typography scale from existing Typography collection variables ────────────
if (typeColl) {
  const _typoVars = _allVars.filter(v => typeColl.variableIds.includes(v.id));
  const scale = {};
  for (const v of _typoVars) {
    const parts = v.name.split('/');
    if (parts.length < 4) continue;
    const prop = parts[parts.length - 1];        // 'size', 'weight', 'tracking', 'line-height'
    const size = parts[parts.length - 2];        // 'lg', 'md', 'sm'
    const role = parts[parts.length - 3];        // 'display', 'headline', etc.
    if (!['size', 'weight', 'tracking', 'line-height'].includes(prop)) continue;
    const key = `${role}/${size}`;
    if (!scale[key]) scale[key] = { weight: null, tracking: null, sizes: [], lineHeights: [] };
    if (prop === 'weight') {
      const val = v.valuesByMode[Object.keys(v.valuesByMode)[0]];
      if (typeof val === 'number') scale[key].weight = val;
    } else if (prop === 'tracking') {
      const val = v.valuesByMode[Object.keys(v.valuesByMode)[0]];
      if (typeof val === 'number') scale[key].tracking = val;
    } else if (prop === 'size') {
      scale[key].sizes = typeColl.modes.map(m => {
        const val = v.valuesByMode[m.modeId];
        return typeof val === 'number' ? val : null;
      });
    } else if (prop === 'line-height') {
      scale[key].lineHeights = typeColl.modes.map(m => {
        const val = v.valuesByMode[m.modeId];
        return typeof val === 'number' ? val : null;
      });
    }
  }
  if (Object.keys(scale).length > 0) {
    detected.typography.scale = scale;
    detected._meta.detectedFields.push('typography.scale');
  }
}

// ── Existing sections ─────────────────────────────────────────────────────────
const _sections = figma.currentPage.children.filter(n => n.type === 'SECTION');
for (const s of _sections) {
  const n = s.name.toLowerCase();
  if (n.includes('component')) detected.sections.components    = s.name;
  if (n.includes('doc'))       detected.sections.documentation = s.name;
  if (n.includes('showcase') || n.includes('token')) detected.sections.showcase = s.name;
}
if (_sections.length > 0) detected._meta.detectedFields.push('sections');

// ── What still needs user input ───────────────────────────────────────────────
if (!detected.project.name)                  detected._meta.needsInput.push('project.name');
if (!detected.project.platform)              detected._meta.needsInput.push('project.platform');
if (!detected.grid.base)                     detected._meta.needsInput.push('grid.base');
if (!detected.breakpoints.tier)              detected._meta.needsInput.push('breakpoints.tier');
if (!detected.color.brand.primary)           detected._meta.needsInput.push('color.brand.primary');
if (!detected.typography.families.sans)      detected._meta.needsInput.push('typography.families.sans');
if (!detected.typography.scale)              detected._meta.needsInput.push('typography.scale');
if (!detected.color.scale)                   detected._meta.needsInput.push('color.scale');
if (!detected.color.semanticStyle)           detected._meta.needsInput.push('color.semanticStyle');

return JSON.stringify(detected);
