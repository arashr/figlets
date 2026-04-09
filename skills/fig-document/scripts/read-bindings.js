// Requires detect-ds-context.js pasted above (provides DS_CONTEXT, _allVars, _toHex).
// Collect all design token bindings on the default variant.
// Set `target` to the default variant node before running (from read-bounds.js).
// Returns JSON: [{ node, property, token, resolvedVal }]
//
// resolvedVal: hex string for colors (#rrggbb), "Npx" for floats, "N/M" for text styles,
//              "—" when resolution fails.
//
// Covers both variable bindings (boundVariables) and text style bindings (textStyleId).
// Uses _allVars (pre-fetched by detect-ds-context.js) — no async variable lookups needed.

function collectBindings(node, bindings = []) {
  if (node.type === 'INSTANCE') return bindings;

  const bv = node.boundVariables || {};
  const checks = [
    ['fills',             'Fill'],
    ['strokes',           'Stroke'],
    ['paddingTop',        'paddingTop'],
    ['paddingBottom',     'paddingBottom'],
    ['paddingLeft',       'paddingLeft'],
    ['paddingRight',      'paddingRight'],
    ['itemSpacing',       'itemSpacing'],
    ['counterAxisSpacing','counterAxisSpacing'],
    ['fontSize',          'fontSize'],
    ['topLeftRadius',     'cornerRadius'],
    ['strokeTopWeight',   'strokeWeight'],
  ];

  for (const [key, label] of checks) {
    if (bv[key]) {
      const entry = Array.isArray(bv[key]) ? bv[key][0] : bv[key];
      if (entry?.id) bindings.push({ node: node.name, property: label, varId: entry.id });
    }
  }

  // Text style binding — textStyleId covers fontSize, lineHeight, weight, tracking, family
  if (node.type === 'TEXT' && node.textStyleId) {
    bindings.push({ node: node.name, property: 'textStyle', styleId: node.textStyleId });
  }

  if ('children' in node) node.children.forEach(c => collectBindings(c, bindings));
  return bindings;
}

// Follow a VARIABLE_ALIAS chain using the pre-fetched _allVars snapshot (sync — no async needed).
function resolveVarValue(varId, depth = 0) {
  if (depth > 4) return null;
  const v = _allVars.find(v => v.id === varId);
  if (!v) return null;
  const raw = Object.values(v.valuesByMode)[0];
  if (v.resolvedType === 'COLOR') {
    if (raw && 'r' in raw) return { type: 'COLOR', v: raw };
    if (raw?.type === 'VARIABLE_ALIAS') return resolveVarValue(raw.id, depth + 1);
  } else if (v.resolvedType === 'FLOAT') {
    if (typeof raw === 'number') return { type: 'FLOAT', v: raw };
    if (raw?.type === 'VARIABLE_ALIAS') return resolveVarValue(raw.id, depth + 1);
  }
  return null;
}

const raw = collectBindings(target);

// Resolve names and values (fully synchronous — no async calls)
const resolved = [];
for (const b of raw) {
  if (b.varId) {
    const v = _allVars.find(v => v.id === b.varId);
    const tokenName = v ? v.name : b.varId;
    let resolvedVal = '—';
    const result = resolveVarValue(b.varId);
    if (result) {
      if (result.type === 'COLOR') {
        const c = result.v;
        const h = x => Math.round(x * 255).toString(16).padStart(2, '0');
        resolvedVal = `#${h(c.r)}${h(c.g)}${h(c.b)}`;
      } else if (result.type === 'FLOAT') {
        resolvedVal = `${result.v}px`;
      }
    }
    resolved.push({ node: b.node, property: b.property, token: tokenName, resolvedVal });
  } else if (b.styleId) {
    const style = Object.values(DS_CONTEXT.textStyleByName).find(s => s.id === b.styleId);
    const styleName = style ? style.name : b.styleId;
    const resolvedVal = style
      ? `${style.fontSize}px / ${typeof style.lineHeight === 'object' ? (style.lineHeight.value ?? '?') : style.lineHeight}`
      : '—';
    resolved.push({ node: b.node, property: 'Text style', token: styleName, resolvedVal });
  }
}
return JSON.stringify(resolved);
