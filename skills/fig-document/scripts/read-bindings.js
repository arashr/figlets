// Requires detect-ds-context.js pasted above (provides DS_CONTEXT).
// Collect all design token bindings on the default variant.
// Set `target` to the default variant node before running (from Step 2).
// Returns JSON: [{ node, property, token }]
//
// Covers both variable bindings (boundVariables) and text style bindings (textStyleId).

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

const raw = collectBindings(target);

// Resolve names: variables via getVariableByIdAsync, text styles from DS_CONTEXT
const resolved = [];
for (const b of raw) {
  if (b.varId) {
    const v = await figma.variables.getVariableByIdAsync(b.varId);
    resolved.push({ node: b.node, property: b.property, token: v ? v.name : b.varId });
  } else if (b.styleId) {
    // Look up text style name from DS_CONTEXT (already loaded) or fall back to API
    const style = Object.values(DS_CONTEXT.textStyleByName).find(s => s.id === b.styleId);
    const styleName = style ? style.name : b.styleId;
    resolved.push({ node: b.node, property: 'Text style', token: styleName });
  }
}
return JSON.stringify(resolved);
